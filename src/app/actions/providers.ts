"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, orderItems, orders, products, providers, vetServices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { GOVERNORATES, PRODUCT_CATEGORIES } from "@/lib/constants";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { normalizePhone, iqd, dateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { saveImage, saveImages } from "@/lib/uploads";

async function myProvider(kind?: "vet" | "shop") {
  const user = await requireUser();
  const rows = await db.select().from(providers).where(eq(providers.userId, user.id));
  const p = kind ? rows.find((r) => r.kind === kind) : rows[0];
  if (!p) throw new UserError("لا يوجد ملف تجاري مرتبط بحسابك.");
  return { user, p };
}

const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).optional(),
);

export async function updateProviderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { p } = await myProvider();
    const s = z
      .object({
        businessName: z.string().trim().min(3, "الاسم قصير جداً").max(160),
        description: z.string().trim().max(3000).optional(),
        city: z.enum(GOVERNORATES.map((g) => g.key) as [string, ...string[]]),
        address: z.string().trim().max(300).optional(),
        phone: z.string().trim().optional(),
        whatsapp: z.string().trim().optional(),
        workingHours: z.string().trim().max(200).optional(),
        specialties: z.string().optional(),
      })
      .safeParse(Object.fromEntries(fd));
    if (!s.success) throw new UserError(s.error.issues[0].message);
    const d = s.data;
    const phone = d.phone ? normalizePhone(d.phone) : null;
    if (d.phone && !phone) throw new UserError("رقم الهاتف غير صحيح.");
    const whatsapp = d.whatsapp ? normalizePhone(d.whatsapp) : null;
    if (d.whatsapp && !whatsapp) throw new UserError("رقم الواتساب غير صحيح.");
    const logoFile = fd.get("logo");
    const logo = logoFile && typeof logoFile === "object" && logoFile.size > 0 ? await saveImage(logoFile) : p.logo;
    const specialties = (d.specialties ?? "")
      .split(/[,،\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12);
    await db
      .update(providers)
      .set({
        businessName: d.businessName,
        description: d.description || null,
        city: d.city,
        address: d.address || null,
        phone,
        whatsapp,
        workingHours: d.workingHours || null,
        specialties,
        logo,
        homeVisits: fd.get("homeVisits") === "on",
        delivery: fd.get("delivery") === "on",
        isActive: fd.get("isActive") === "on",
      })
      .where(eq(providers.id, p.id));
    revalidatePath(`/${p.kind === "vet" ? "vets" : "shops"}/${p.id}`);
    return { ok: true, message: "تم حفظ الملف التجاري." };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------- Vet services ----------

export async function saveServiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { p } = await myProvider("vet");
    const s = z
      .object({
        id: optInt,
        name: z.string().trim().min(2, "أدخل اسم الخدمة").max(120),
        description: z.string().trim().max(1000).optional(),
        price: optInt,
        durationMinutes: z.preprocess((v) => Number(v || 30), z.number().int().min(5).max(600)),
      })
      .safeParse(Object.fromEntries(fd));
    if (!s.success) throw new UserError(s.error.issues[0].message);
    const { id, ...d } = s.data;
    const values = { ...d, description: d.description || null, price: d.price ?? null };
    if (id) await db.update(vetServices).set(values).where(and(eq(vetServices.id, id), eq(vetServices.providerId, p.id)));
    else await db.insert(vetServices).values({ ...values, providerId: p.id });
    revalidatePath("/dashboard/business");
    return { ok: true, message: "تم حفظ الخدمة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteServiceAction(fd: FormData) {
  const { p } = await myProvider("vet");
  await db
    .update(vetServices)
    .set({ isActive: false })
    .where(and(eq(vetServices.id, Number(fd.get("id"))), eq(vetServices.providerId, p.id)));
  revalidatePath("/dashboard/business");
}

// ---------- Bookings ----------

export async function createBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const providerId = Number(fd.get("providerId"));
    const [p] = await db.select().from(providers).where(and(eq(providers.id, providerId), eq(providers.kind, "vet")));
    if (!p || !p.isActive) throw new UserError("العيادة غير متاحة.");
    if (p.userId === user.id) throw new UserError("لا يمكنك الحجز في عيادتك.");
    const date = String(fd.get("date") ?? "");
    const time = String(fd.get("time") ?? "");
    const scheduledAt = new Date(`${date}T${time}:00+03:00`);
    if (Number.isNaN(scheduledAt.getTime())) throw new UserError("حدد التاريخ والوقت.");
    if (scheduledAt.getTime() < Date.now()) throw new UserError("اختر موعداً في المستقبل.");
    const serviceId = Number(fd.get("serviceId")) || null;
    if (serviceId) {
      const [svc] = await db.select().from(vetServices).where(and(eq(vetServices.id, serviceId), eq(vetServices.providerId, p.id)));
      if (!svc) throw new UserError("الخدمة غير موجودة.");
    }
    const animalType = String(fd.get("animalType") ?? "").trim();
    if (!animalType) throw new UserError("حدد نوع الحيوان.");
    const homeVisit = fd.get("homeVisit") === "on";
    if (homeVisit && !p.homeVisits) throw new UserError("هذه العيادة لا تقدم زيارات منزلية.");
    await db.insert(bookings).values({
      providerId: p.id,
      userId: user.id,
      serviceId,
      scheduledAt,
      animalType: animalType.slice(0, 60),
      animalCount: Math.max(1, Number(fd.get("animalCount")) || 1),
      homeVisit,
      notes: String(fd.get("notes") ?? "").slice(0, 2000) || null,
    });
    await notify(p.userId, "حجز جديد", `${user.name} طلب موعداً بتاريخ ${dateTime(scheduledAt)}`, "/dashboard/business?tab=bookings");
    return { ok: true, message: "تم إرسال طلب الحجز. سيصلك إشعار عند تأكيده من العيادة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateBookingAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as "confirmed" | "completed" | "cancelled" | "rejected";
  const [b] = await db
    .select({ b: bookings, p: providers })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, id));
  if (!b) return;
  const isProvider = b.p.userId === user.id;
  const isCustomer = b.b.userId === user.id;
  const allowed = isProvider ? ["confirmed", "completed", "rejected", "cancelled"] : isCustomer ? ["cancelled"] : [];
  if (!allowed.includes(status)) return;
  if (["completed", "cancelled", "rejected"].includes(b.b.status)) return;
  await db
    .update(bookings)
    .set({ status, providerNote: isProvider ? String(fd.get("note") ?? "") || b.b.providerNote : b.b.providerNote })
    .where(eq(bookings.id, id));
  const labels: Record<string, string> = { confirmed: "تم تأكيد موعدك", completed: "تم إكمال الموعد", rejected: "تعذر قبول الحجز", cancelled: "تم إلغاء الموعد" };
  const target = isProvider ? b.b.userId : b.p.userId;
  await notify(target, labels[status], `${b.p.businessName} - ${dateTime(b.b.scheduledAt)}`, isProvider ? "/dashboard/bookings" : "/dashboard/business?tab=bookings");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/business");
}

// ---------- Products ----------

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { p } = await myProvider("shop");
    const s = z
      .object({
        id: optInt,
        name: z.string().trim().min(2, "أدخل اسم المنتج").max(160),
        category: z.enum(PRODUCT_CATEGORIES.map((c) => c.key) as [string, ...string[]]),
        description: z.string().trim().max(2000).optional(),
        price: z.preprocess((v) => Number(v), z.number().int().min(0, "السعر غير صحيح")),
        unit: z.string().trim().max(30).optional(),
        stock: z.preprocess((v) => Number(v || 0), z.number().int().min(0)),
      })
      .safeParse(Object.fromEntries(fd));
    if (!s.success) throw new UserError(s.error.issues[0].message);
    const { id, ...d } = s.data;
    const values = { ...d, description: d.description || null, unit: d.unit || null, isActive: true };
    if (id) {
      const [existing] = await db.select().from(products).where(and(eq(products.id, id), eq(products.providerId, p.id)));
      if (!existing) throw new UserError("المنتج غير موجود.");
      const keep = fd.getAll("keepImages").map(String).filter((u) => existing.images.includes(u));
      const added = await saveImages(fd.getAll("images"), 4 - keep.length);
      await db.update(products).set({ ...values, images: [...keep, ...added] }).where(eq(products.id, id));
    } else {
      const images = await saveImages(fd.getAll("images"), 4);
      await db.insert(products).values({ ...values, images, providerId: p.id });
    }
    revalidatePath("/dashboard/business");
    revalidatePath(`/shops/${p.id}`);
    return { ok: true, message: "تم حفظ المنتج." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteProductAction(fd: FormData) {
  const { p } = await myProvider("shop");
  await db
    .update(products)
    .set({ isActive: false })
    .where(and(eq(products.id, Number(fd.get("id"))), eq(products.providerId, p.id)));
  revalidatePath("/dashboard/business");
}

// ---------- Orders ----------

export async function createOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const providerId = Number(fd.get("providerId"));
    const [p] = await db.select().from(providers).where(and(eq(providers.id, providerId), eq(providers.kind, "shop")));
    if (!p || !p.isActive) throw new UserError("المحل غير متاح.");
    if (p.userId === user.id) throw new UserError("لا يمكنك الطلب من محلك.");
    const qty = new Map<number, number>();
    for (const [k, v] of fd.entries()) {
      const m = /^qty_(\d+)$/.exec(k);
      const n = Math.floor(Number(v));
      if (m && n > 0) qty.set(Number(m[1]), Math.min(n, 1000));
    }
    if (!qty.size) throw new UserError("اختر كمية لمنتج واحد على الأقل.");
    const fulfilment = fd.get("fulfilment") === "delivery" ? "delivery" : "pickup";
    if (fulfilment === "delivery" && !p.delivery) throw new UserError("هذا المحل لا يوفر التوصيل.");
    const address = String(fd.get("address") ?? "").trim();
    if (fulfilment === "delivery" && address.length < 5) throw new UserError("أدخل عنوان التوصيل.");
    const phone = normalizePhone(String(fd.get("phone") ?? user.phone)) ?? user.phone;

    const orderId = await db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(products)
        .where(and(eq(products.providerId, p.id), eq(products.isActive, true), inArray(products.id, [...qty.keys()])));
      if (!items.length) throw new UserError("المنتجات غير متاحة.");
      for (const it of items)
        if (it.stock < qty.get(it.id)!) throw new UserError(`الكمية المتوفرة من «${it.name}» هي ${it.stock} فقط.`);
      const total = items.reduce((s, it) => s + it.price * qty.get(it.id)!, 0);
      const [o] = await tx
        .insert(orders)
        .values({ providerId: p.id, userId: user.id, fulfilment, address: address || null, phone, notes: String(fd.get("notes") ?? "").slice(0, 1000) || null, total })
        .returning({ id: orders.id });
      for (const it of items) {
        const q = qty.get(it.id)!;
        await tx.insert(orderItems).values({ orderId: o.id, productId: it.id, name: it.name, unitPrice: it.price, quantity: q });
        await tx.update(products).set({ stock: sql`${products.stock} - ${q}` }).where(eq(products.id, it.id));
      }
      await notify(p.userId, "طلب جديد 🛒", `${user.name} - المجموع ${iqd(total)}`, "/dashboard/business?tab=orders", tx);
      return o.id;
    });
    return { ok: true, message: `تم إرسال الطلب رقم #${orderId}. سيتواصل معك المحل لتأكيده. الدفع عند الاستلام.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateOrderAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as "confirmed" | "ready" | "delivered" | "cancelled";
  const [row] = await db
    .select({ o: orders, p: providers })
    .from(orders)
    .innerJoin(providers, eq(providers.id, orders.providerId))
    .where(eq(orders.id, id));
  if (!row || ["delivered", "cancelled"].includes(row.o.status)) return;
  const isShop = row.p.userId === user.id;
  const isCustomer = row.o.userId === user.id;
  const allowed = isShop ? ["confirmed", "ready", "delivered", "cancelled"] : isCustomer && row.o.status === "pending" ? ["cancelled"] : [];
  if (!allowed.includes(status)) return;
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status }).where(eq(orders.id, id));
    if (status === "cancelled") {
      // Return stock.
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      for (const it of items)
        if (it.productId)
          await tx.update(products).set({ stock: sql`${products.stock} + ${it.quantity}` }).where(eq(products.id, it.productId));
    }
  });
  const labels: Record<string, string> = { confirmed: "تم تأكيد طلبك", ready: "طلبك جاهز", delivered: "تم تسليم طلبك", cancelled: "تم إلغاء الطلب" };
  await notify(isShop ? row.o.userId : row.p.userId, `${labels[status]} #${id}`, row.p.businessName, isShop ? "/dashboard/orders" : "/dashboard/business?tab=orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/business");
}
