"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { favorites, listings, reports } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ANIMAL_CATEGORIES, GOVERNORATES, REPORT_REASONS } from "@/lib/constants";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { assertCanCreateListing } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { saveImages } from "@/lib/uploads";
import { moveFunds } from "@/lib/wallet";

const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/,/g, ""))),
  z.number().int().min(0).optional(),
);

const listingSchema = z.object({
  type: z.enum(["offer", "wanted"]),
  category: z.enum(ANIMAL_CATEGORIES.map((c) => c.key) as [string, ...string[]], { message: "اختر نوع الحيوان" }),
  breed: z.string().trim().max(80).optional(),
  title: z.string().trim().min(5, "العنوان قصير جداً").max(160),
  description: z.string().trim().min(10, "أضف وصفاً أوضح (10 أحرف على الأقل)").max(5000),
  price: optInt,
  negotiable: z.preprocess((v) => v === "on", z.boolean()),
  quantity: z.preprocess((v) => Number(v || 1), z.number().int().min(1, "العدد غير صحيح").max(100000)),
  ageMonths: optInt,
  gender: z.enum(["male", "female", "mixed", "unknown"]),
  weightKg: optInt,
  city: z.enum(GOVERNORATES.map((g) => g.key) as [string, ...string[]], { message: "اختر المحافظة" }),
  area: z.string().trim().max(80).optional(),
});

function parseListing(fd: FormData) {
  const parsed = listingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  return parsed.data;
}

export async function createListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireUser();
    const d = parseListing(fd);
    await assertCanCreateListing(user.id);
    const images = await saveImages(fd.getAll("images"));
    if (d.type === "offer" && images.length === 0) throw new UserError("أضف صورة واحدة على الأقل للحيوان.");
    const [row] = await db
      .insert(listings)
      .values({ ...d, userId: user.id, images, breed: d.breed || null, area: d.area || null })
      .returning({ id: listings.id });
    id = row.id;
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/listings");
  redirect(`/listings/${id}?created=1`);
}

async function ownListing(id: number) {
  const user = await requireUser();
  const [l] = await db.select().from(listings).where(eq(listings.id, id));
  if (!l || (l.userId !== user.id && user.role !== "admin")) throw new UserError("الإعلان غير موجود.");
  return { user, l };
}

export async function updateListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = Number(fd.get("id"));
  try {
    const { l } = await ownListing(id);
    const d = parseListing(fd);
    const keep = fd.getAll("keepImages").map(String).filter((u) => l.images.includes(u));
    const added = await saveImages(fd.getAll("images"), 8 - keep.length);
    await db
      .update(listings)
      .set({ ...d, breed: d.breed || null, area: d.area || null, images: [...keep, ...added], updatedAt: new Date() })
      .where(eq(listings.id, id));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(`/listings/${id}`);
  redirect(`/listings/${id}`);
}

export async function setListingStatusAction(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as "active" | "sold" | "hidden" | "removed";
  if (!["active", "sold", "hidden", "removed"].includes(status)) return;
  const { l } = await ownListing(id);
  if (status === "active" && l.status !== "active") await assertCanCreateListing(l.userId);
  await db.update(listings).set({ status, updatedAt: new Date() }).where(eq(listings.id, id));
  revalidatePath("/dashboard/listings");
  revalidatePath(`/listings/${id}`);
}

export async function featureListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const id = Number(fd.get("id"));
    const { user, l } = await ownListing(id);
    if (l.status !== "active") throw new UserError("يمكن تمييز الإعلانات النشطة فقط.");
    const s = await getSettings();
    await db.transaction(async (tx) => {
      await moveFunds(tx, {
        userId: user.id,
        amount: -s.featuredListingPrice,
        type: "featured",
        reference: `listing:${id}`,
        note: `تمييز إعلان لمدة 7 أيام: ${l.title}`,
      });
      const base = l.featuredUntil && l.featuredUntil > new Date() ? l.featuredUntil : new Date();
      await tx
        .update(listings)
        .set({ featuredUntil: new Date(base.getTime() + 7 * 86400_000) })
        .where(eq(listings.id, id));
    });
    revalidatePath(`/listings/${id}`);
    return { ok: true, message: "تم تمييز الإعلان لمدة 7 أيام وسيظهر في أعلى النتائج." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleFavoriteAction(fd: FormData) {
  const user = await requireUser();
  const listingId = Number(fd.get("id"));
  const existing = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, user.id), eq(favorites.listingId, listingId)));
  if (existing.length) await db.delete(favorites).where(eq(favorites.id, existing[0].id));
  else await db.insert(favorites).values({ userId: user.id, listingId }).onConflictDoNothing();
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/dashboard/favorites");
}

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const targetType = String(fd.get("targetType"));
    const targetId = Number(fd.get("targetId"));
    const reason = String(fd.get("reason"));
    if (!["listing", "auction", "user", "provider"].includes(targetType) || !targetId)
      throw new UserError("بلاغ غير صالح.");
    if (!REPORT_REASONS.some((r) => r.key === reason)) throw new UserError("اختر سبب البلاغ.");
    await db.insert(reports).values({
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      details: String(fd.get("details") ?? "").slice(0, 2000) || null,
    });
    return { ok: true, message: "شكراً لك. وصل البلاغ إلى فريق الإدارة وسيتم مراجعته." };
  } catch (e) {
    return toActionError(e);
  }
}
