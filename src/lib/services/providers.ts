import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orderItems, orders, products, providers, users, vetServices } from "@/db/schema";
import type { SessionUser } from "../auth";
import { UserError } from "../errors";
import { dateTime, iqd, normalizePhone } from "../format";
import { notify } from "../notify";
import { bookingInput, orderInput, parse, productInput, providerInput, serviceInput } from "../validation";

export async function getMyProvider(user: SessionUser, kind?: "vet" | "shop") {
  const rows = await db.select().from(providers).where(eq(providers.userId, user.id));
  const p = kind ? rows.find((r) => r.kind === kind) : rows[0];
  if (!p) throw new UserError("لا يوجد ملف تجاري مرتبط بحسابك.");
  return p;
}

/** `logo`: a stored image URL, `undefined` to keep the current one. */
export async function updateProvider(user: SessionUser, input: unknown, logo?: string | null) {
  const p = await getMyProvider(user);
  const d = parse(providerInput, input);
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) throw new UserError("رقم الهاتف غير صحيح.");
  const whatsapp = d.whatsapp ? normalizePhone(d.whatsapp) : null;
  if (d.whatsapp && !whatsapp) throw new UserError("رقم الواتساب غير صحيح.");
  const [row] = await db
    .update(providers)
    .set({
      businessName: d.businessName,
      description: d.description || null,
      city: d.city,
      address: d.address || null,
      phone,
      whatsapp,
      workingHours: d.workingHours || null,
      specialties: d.specialties,
      logo: logo === undefined ? p.logo : logo,
      homeVisits: d.homeVisits,
      delivery: d.delivery,
      isActive: d.isActive,
    })
    .where(eq(providers.id, p.id))
    .returning();
  return row;
}

// ---------- Vet services ----------

export async function saveService(user: SessionUser, input: unknown) {
  const p = await getMyProvider(user, "vet");
  const { id, ...d } = parse(serviceInput, input);
  const values = { ...d, description: d.description || null, price: d.price ?? null };
  if (id) {
    const [row] = await db
      .update(vetServices)
      .set(values)
      .where(and(eq(vetServices.id, id), eq(vetServices.providerId, p.id), eq(vetServices.isActive, true)))
      .returning();
    if (!row) throw new UserError("الخدمة غير موجودة.");
    return row;
  }
  const [row] = await db.insert(vetServices).values({ ...values, providerId: p.id }).returning();
  return row;
}

export async function deleteService(user: SessionUser, id: number) {
  const p = await getMyProvider(user, "vet");
  await db.update(vetServices).set({ isActive: false }).where(and(eq(vetServices.id, id), eq(vetServices.providerId, p.id)));
}

// ---------- Bookings ----------

export async function createBooking(user: SessionUser, input: unknown) {
  const d = parse(bookingInput, input);
  const [p] = await db.select().from(providers).where(and(eq(providers.id, d.providerId), eq(providers.kind, "vet")));
  if (!p || !p.isActive) throw new UserError("العيادة غير متاحة.");
  if (p.userId === user.id) throw new UserError("لا يمكنك الحجز في عيادتك.");
  const scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : new Date(`${d.date}T${d.time}:00+03:00`);
  if (Number.isNaN(scheduledAt.getTime())) throw new UserError("حدد التاريخ والوقت.");
  if (scheduledAt.getTime() < Date.now()) throw new UserError("اختر موعداً في المستقبل.");
  const serviceId = d.serviceId || null;
  if (serviceId) {
    const [svc] = await db.select().from(vetServices).where(and(eq(vetServices.id, serviceId), eq(vetServices.providerId, p.id)));
    if (!svc) throw new UserError("الخدمة غير موجودة.");
  }
  if (d.homeVisit && !p.homeVisits) throw new UserError("هذه العيادة لا تقدم زيارات منزلية.");
  const [row] = await db
    .insert(bookings)
    .values({
      providerId: p.id,
      userId: user.id,
      serviceId,
      scheduledAt,
      animalType: d.animalType,
      animalCount: d.animalCount,
      homeVisit: d.homeVisit,
      notes: d.notes || null,
    })
    .returning();
  await notify(p.userId, "حجز جديد", `${user.name} طلب موعداً بتاريخ ${dateTime(scheduledAt)}`, "/dashboard/business?tab=bookings");
  return row;
}

const BOOKING_LABELS: Record<string, string> = {
  confirmed: "تم تأكيد موعدك",
  completed: "تم إكمال الموعد",
  rejected: "تعذر قبول الحجز",
  cancelled: "تم إلغاء الموعد",
};

export async function updateBookingStatus(user: SessionUser, id: number, status: string, note?: string | null) {
  const [b] = await db
    .select({ b: bookings, p: providers })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .where(eq(bookings.id, id));
  if (!b) throw new UserError("الحجز غير موجود.");
  const isProvider = b.p.userId === user.id;
  const isCustomer = b.b.userId === user.id;
  const allowed = isProvider ? ["confirmed", "completed", "rejected", "cancelled"] : isCustomer ? ["cancelled"] : [];
  if (!allowed.includes(status)) throw new UserError("لا يمكنك تنفيذ هذا الإجراء.");
  if (["completed", "cancelled", "rejected"].includes(b.b.status)) throw new UserError("الحجز منتهٍ ولا يمكن تعديله.");
  const [row] = await db
    .update(bookings)
    .set({
      status: status as "confirmed" | "completed" | "rejected" | "cancelled",
      providerNote: isProvider ? note?.slice(0, 1000) || b.b.providerNote : b.b.providerNote,
    })
    .where(and(eq(bookings.id, id), eq(bookings.status, b.b.status)))
    .returning();
  if (!row) throw new UserError("تغيرت حالة الحجز. حدّث الصفحة وحاول مرة أخرى.");
  await notify(
    isProvider ? b.b.userId : b.p.userId,
    BOOKING_LABELS[status],
    `${b.p.businessName} - ${dateTime(b.b.scheduledAt)}`,
    isProvider ? "/dashboard/bookings" : "/dashboard/business?tab=bookings",
  );
  return row;
}

// ---------- Products ----------

/** `images`: final list of stored image URLs. */
export async function saveProduct(user: SessionUser, input: unknown, images: string[]) {
  const p = await getMyProvider(user, "shop");
  const { id, ...d } = parse(productInput, input);
  if (images.length > 4) throw new UserError("الحد الأقصى 4 صور.");
  const values = { ...d, description: d.description || null, unit: d.unit || null, isActive: true, images };
  if (id) {
    // Deleted products stay deleted.
    const [row] = await db
      .update(products)
      .set(values)
      .where(and(eq(products.id, id), eq(products.providerId, p.id), eq(products.isActive, true)))
      .returning();
    if (!row) throw new UserError("المنتج غير موجود.");
    return row;
  }
  const [row] = await db.insert(products).values({ ...values, providerId: p.id }).returning();
  return row;
}

export async function getMyProduct(user: SessionUser, id: number) {
  const p = await getMyProvider(user, "shop");
  const [row] = await db.select().from(products).where(and(eq(products.id, id), eq(products.providerId, p.id), eq(products.isActive, true)));
  if (!row) throw new UserError("المنتج غير موجود.");
  return row;
}

export async function deleteProduct(user: SessionUser, id: number) {
  const p = await getMyProvider(user, "shop");
  await db.update(products).set({ isActive: false }).where(and(eq(products.id, id), eq(products.providerId, p.id)));
}

// ---------- Orders ----------

export async function createOrder(user: SessionUser, input: unknown) {
  const d = parse(orderInput, input);
  const [p] = await db.select().from(providers).where(and(eq(providers.id, d.providerId), eq(providers.kind, "shop")));
  if (!p || !p.isActive) throw new UserError("المحل غير متاح.");
  if (p.userId === user.id) throw new UserError("لا يمكنك الطلب من محلك.");
  const qty = new Map<number, number>();
  for (const it of d.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
  if (d.fulfilment === "delivery" && !p.delivery) throw new UserError("هذا المحل لا يوفر التوصيل.");
  const address = (d.address ?? "").trim();
  if (d.fulfilment === "delivery" && address.length < 5) throw new UserError("أدخل عنوان التوصيل.");
  const phone = (d.phone && normalizePhone(d.phone)) || user.phone;

  return db.transaction(async (tx) => {
    // Lock the product rows so two orders can't oversell the same stock.
    await tx.execute(sql`select id from products where id in ${[...qty.keys()]} for update`);
    const items = await tx
      .select()
      .from(products)
      .where(and(eq(products.providerId, p.id), eq(products.isActive, true), inArray(products.id, [...qty.keys()])));
    if (items.length !== qty.size) throw new UserError("بعض المنتجات غير متاحة.");
    for (const it of items)
      if (it.stock < qty.get(it.id)!) throw new UserError(`الكمية المتوفرة من «${it.name}» هي ${it.stock} فقط.`);
    const total = items.reduce((s, it) => s + it.price * qty.get(it.id)!, 0);
    const [o] = await tx
      .insert(orders)
      .values({ providerId: p.id, userId: user.id, fulfilment: d.fulfilment, address: address || null, phone, notes: d.notes || null, total })
      .returning();
    for (const it of items) {
      const q = qty.get(it.id)!;
      await tx.insert(orderItems).values({ orderId: o.id, productId: it.id, name: it.name, unitPrice: it.price, quantity: q });
      await tx.update(products).set({ stock: sql`${products.stock} - ${q}` }).where(eq(products.id, it.id));
    }
    await notify(p.userId, "طلب جديد 🛒", `${user.name} - المجموع ${iqd(total)}`, "/dashboard/business?tab=orders", tx);
    return o;
  });
}

const ORDER_LABELS: Record<string, string> = {
  confirmed: "تم تأكيد طلبك",
  ready: "طلبك جاهز",
  delivered: "تم تسليم طلبك",
  cancelled: "تم إلغاء الطلب",
};

export async function updateOrderStatus(user: SessionUser, id: number, status: string) {
  const [row] = await db
    .select({ o: orders, p: providers })
    .from(orders)
    .innerJoin(providers, eq(providers.id, orders.providerId))
    .where(eq(orders.id, id));
  if (!row) throw new UserError("الطلب غير موجود.");
  if (["delivered", "cancelled"].includes(row.o.status)) throw new UserError("الطلب منتهٍ ولا يمكن تعديله.");
  const isShop = row.p.userId === user.id;
  const isCustomer = row.o.userId === user.id;
  const allowed = isShop
    ? ["confirmed", "ready", "delivered", "cancelled"]
    : isCustomer && row.o.status === "pending"
      ? ["cancelled"]
      : [];
  if (!allowed.includes(status)) throw new UserError("لا يمكنك تنفيذ هذا الإجراء.");
  const updated = await db.transaction(async (tx) => {
    // Only move an order still in the state we checked, so stock is returned exactly once.
    const [u] = await tx
      .update(orders)
      .set({ status: status as "confirmed" | "ready" | "delivered" | "cancelled" })
      .where(and(eq(orders.id, id), eq(orders.status, row.o.status)))
      .returning();
    if (!u) throw new UserError("تغيرت حالة الطلب. حدّث الصفحة وحاول مرة أخرى.");
    if (status === "cancelled") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      for (const it of items)
        if (it.productId) await tx.update(products).set({ stock: sql`${products.stock} + ${it.quantity}` }).where(eq(products.id, it.productId));
    }
    return u;
  });
  await notify(
    isShop ? row.o.userId : row.p.userId,
    `${ORDER_LABELS[status]} #${id}`,
    row.p.businessName,
    isShop ? "/dashboard/orders" : "/dashboard/business?tab=orders",
  );
  return updated;
}

// ---------- Reads ----------

export async function getProviderDetail(id: number) {
  const [row] = await db
    .select({ p: providers, verificationStatus: users.verificationStatus, banned: users.isBanned })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(eq(providers.id, id));
  if (!row || row.banned || !row.p.isActive) return null;
  const [services, prods] = await Promise.all([
    row.p.kind === "vet"
      ? db.select().from(vetServices).where(and(eq(vetServices.providerId, id), eq(vetServices.isActive, true)))
      : [],
    row.p.kind === "shop"
      ? db.select().from(products).where(and(eq(products.providerId, id), eq(products.isActive, true))).orderBy(asc(products.category), asc(products.name))
      : [],
  ]);
  return { provider: row.p, verificationStatus: row.verificationStatus, services, products: prods };
}

async function withItems<T extends { id: number }>(rows: T[]) {
  if (!rows.length) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
}

export async function myBookings(userId: number) {
  const rows = await db
    .select({ b: bookings, provider: { id: providers.id, businessName: providers.businessName, phone: providers.phone }, serviceName: vetServices.name })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .leftJoin(vetServices, eq(vetServices.id, bookings.serviceId))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.scheduledAt));
  return rows.map((r) => ({ ...r.b, provider: r.provider, serviceName: r.serviceName }));
}

export async function myOrders(userId: number) {
  const rows = await db
    .select({ o: orders, provider: { id: providers.id, businessName: providers.businessName, phone: providers.phone } })
    .from(orders)
    .innerJoin(providers, eq(providers.id, orders.providerId))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  return withItems(rows.map((r) => ({ ...r.o, provider: r.provider })));
}

export async function businessBookings(user: SessionUser) {
  const p = await getMyProvider(user, "vet");
  const rows = await db
    .select({ b: bookings, customer: { name: users.name, phone: users.phone }, serviceName: vetServices.name })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(vetServices, eq(vetServices.id, bookings.serviceId))
    .where(eq(bookings.providerId, p.id))
    .orderBy(desc(bookings.scheduledAt))
    .limit(200);
  return rows.map((r) => ({ ...r.b, customer: r.customer, serviceName: r.serviceName }));
}

export async function businessOrders(user: SessionUser) {
  const p = await getMyProvider(user, "shop");
  const rows = await db
    .select({ o: orders, customer: { name: users.name } })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.providerId, p.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);
  return withItems(rows.map((r) => ({ ...r.o, customer: r.customer })));
}

export async function myBusiness(user: SessionUser) {
  const p = await getMyProvider(user);
  const detail = await db.transaction(async (tx) => {
    const services = p.kind === "vet" ? await tx.select().from(vetServices).where(and(eq(vetServices.providerId, p.id), eq(vetServices.isActive, true))) : [];
    const prods = p.kind === "shop" ? await tx.select().from(products).where(and(eq(products.providerId, p.id), eq(products.isActive, true))).orderBy(desc(products.createdAt)) : [];
    return { services, products: prods };
  });
  return { provider: p, ...detail };
}
