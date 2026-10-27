"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { saveImage, saveImages } from "@/lib/uploads";
import { formObject } from "@/lib/validation";
import {
  createBooking,
  createOrder,
  deleteProduct,
  deleteService,
  getMyProduct,
  saveProduct,
  saveService,
  updateBookingStatus,
  updateOrderStatus,
  updateProvider,
} from "@/lib/services/providers";

/** Run a state-less form action; validation errors are ignored like before (the page simply re-renders). */
async function quietly(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
  }
}

export async function updateProviderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const logo = (await saveImage(fd.get("logo"), { userId: user.id })) ?? undefined;
    const p = await updateProvider(user, formObject(fd), logo);
    revalidatePath(`/${p.kind === "vet" ? "vets" : "shops"}/${p.id}`);
    return { ok: true, message: "تم حفظ الملف التجاري." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveServiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await saveService(await requireUser(), formObject(fd));
    revalidatePath("/dashboard/business");
    return { ok: true, message: "تم حفظ الخدمة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteServiceAction(fd: FormData) {
  const user = await requireUser();
  await quietly(() => deleteService(user, Number(fd.get("id"))));
  revalidatePath("/dashboard/business");
}

export async function createBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await createBooking(await requireUser(), formObject(fd));
    return { ok: true, message: "تم إرسال طلب الحجز. سيصلك إشعار عند تأكيده من العيادة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateBookingAction(fd: FormData) {
  const user = await requireUser();
  await quietly(() => updateBookingStatus(user, Number(fd.get("id")), String(fd.get("status")), String(fd.get("note") ?? "")));
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/business");
}

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const id = Number(fd.get("id")) || 0;
    let images: string[];
    if (id) {
      const existing = await getMyProduct(user, id);
      const keep = fd.getAll("keepImages").map(String).filter((u) => existing.images.includes(u));
      images = [...keep, ...(await saveImages(fd.getAll("images"), 4 - keep.length, { userId: user.id }))];
    } else images = await saveImages(fd.getAll("images"), 4, { userId: user.id });
    const p = await saveProduct(user, formObject(fd), images);
    revalidatePath("/dashboard/business");
    revalidatePath(`/shops/${p.providerId}`);
    return { ok: true, message: "تم حفظ المنتج." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteProductAction(fd: FormData) {
  const user = await requireUser();
  await quietly(() => deleteProduct(user, Number(fd.get("id"))));
  revalidatePath("/dashboard/business");
}

export async function createOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const items: { productId: number; quantity: number }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = /^qty_(\d+)$/.exec(k);
      const n = Math.floor(Number(v));
      if (m && n > 0) items.push({ productId: Number(m[1]), quantity: Math.min(n, 1000) });
    }
    const o = await createOrder(user, { ...formObject(fd), items });
    return { ok: true, message: `تم إرسال الطلب رقم #${o.id}. سيتواصل معك المحل لتأكيده. الدفع عند الاستلام.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateOrderAction(fd: FormData) {
  const user = await requireUser();
  await quietly(() => updateOrderStatus(user, Number(fd.get("id")), String(fd.get("status"))));
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/business");
}
