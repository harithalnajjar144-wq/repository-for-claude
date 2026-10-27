import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { favorites, listings, reports, users, type Listing } from "@/db/schema";
import type { SessionUser } from "../auth";
import { UserError } from "../errors";
import { assertCanCreateListing } from "../plans";
import { getSettings } from "../settings";
import { assertUploadedImages } from "../uploads";
import { moveFunds } from "../wallet";
import { listingInput, listingStatus, parse, reportInput } from "../validation";

const MAX_IMAGES = 8;

/** Seller fields everyone may see. Phone numbers only go to signed-in users. */
export const sellerPublicCols = {
  id: users.id,
  name: users.name,
  city: users.city,
  role: users.role,
  verificationStatus: users.verificationStatus,
  createdAt: users.createdAt,
};

/** Images in `images` must already be stored (web: saved from the form; API: checked with assertUploadedImages). */
export async function createListing(user: SessionUser, input: unknown, images: string[]) {
  const d = parse(listingInput, input);
  if (images.length > MAX_IMAGES) throw new UserError(`الحد الأقصى ${MAX_IMAGES} صور.`);
  if (d.type === "offer" && images.length === 0) throw new UserError("أضف صورة واحدة على الأقل للحيوان.");
  return db.transaction(async (tx) => {
    // One create at a time per user, so parallel requests cannot pass the plan limit together.
    await tx.execute(sql`select id from users where id = ${user.id} for update`);
    await assertCanCreateListing(user.id, tx);
    const [row] = await tx
      .insert(listings)
      .values({ ...d, userId: user.id, images, breed: d.breed || null, area: d.area || null })
      .returning();
    return row;
  });
}

export async function getOwnListing(user: SessionUser, id: number) {
  const [l] = await db.select().from(listings).where(eq(listings.id, id));
  if (!l || (l.userId !== user.id && user.role !== "admin")) throw new UserError("الإعلان غير موجود.");
  return l;
}

/** API helper: accept the listing's current images plus newly uploaded ones. */
export async function resolveListingImages(userId: number, urls: string[], existing: string[] = []) {
  const kept = urls.filter((u) => existing.includes(u));
  const added = await assertUploadedImages(urls.filter((u) => !existing.includes(u)), { max: MAX_IMAGES, userId });
  const all = [...new Set([...kept, ...added])];
  if (all.length > MAX_IMAGES) throw new UserError(`الحد الأقصى ${MAX_IMAGES} صور.`);
  return urls.filter((u) => all.includes(u)); // keep the client's order
}

export async function updateListing(user: SessionUser, id: number, input: unknown, images: string[]) {
  await getOwnListing(user, id);
  const d = parse(listingInput, input);
  if (images.length > MAX_IMAGES) throw new UserError(`الحد الأقصى ${MAX_IMAGES} صور.`);
  const [row] = await db
    .update(listings)
    .set({
      ...d,
      // Cleared optional fields must become NULL, not be left unchanged.
      price: d.price ?? null,
      ageMonths: d.ageMonths ?? null,
      weightKg: d.weightKg ?? null,
      breed: d.breed || null,
      area: d.area || null,
      images,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, id))
    .returning();
  return row;
}

export async function setListingStatus(user: SessionUser, id: number, status: unknown) {
  const s = parse(listingStatus, status);
  const l = await getOwnListing(user, id);
  if (l.moderatedAt && user.role !== "admin") throw new UserError("أوقفت الإدارة هذا الإعلان. تواصل مع الدعم.");
  if (s === "active" && l.status !== "active") await assertCanCreateListing(l.userId);
  const [row] = await db.update(listings).set({ status: s, updatedAt: new Date() }).where(eq(listings.id, id)).returning();
  return row;
}

export async function featureListing(user: SessionUser, id: number) {
  const l = await getOwnListing(user, id);
  if (l.status !== "active") throw new UserError("يمكن تمييز الإعلانات النشطة فقط.");
  const s = await getSettings();
  return db.transaction(async (tx) => {
    // Lock the listing so two taps cannot both extend from the same date.
    const [locked] = await tx.select().from(listings).where(eq(listings.id, id)).for("update");
    if (locked.status !== "active") throw new UserError("يمكن تمييز الإعلانات النشطة فقط.");
    await moveFunds(tx, {
      userId: user.id,
      amount: -s.featuredListingPrice,
      type: "featured",
      reference: `listing:${id}`,
      note: `تمييز إعلان لمدة 7 أيام: ${l.title}`,
    });
    const base = locked.featuredUntil && locked.featuredUntil > new Date() ? locked.featuredUntil : new Date();
    const featuredUntil = new Date(base.getTime() + 7 * 86400_000);
    await tx.update(listings).set({ featuredUntil }).where(eq(listings.id, id));
    return featuredUntil;
  });
}

/** Returns true if the listing is now a favorite. */
export async function setFavorite(userId: number, listingId: number, on?: boolean) {
  const [existing] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
  const want = on ?? !existing;
  if (want && !existing) {
    const [l] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId));
    if (!l) throw new UserError("الإعلان غير موجود.");
    await db.insert(favorites).values({ userId, listingId }).onConflictDoNothing();
  } else if (!want && existing) await db.delete(favorites).where(eq(favorites.id, existing.id));
  return want;
}

export async function createReport(user: SessionUser, input: unknown) {
  const d = parse(reportInput, input);
  await db.insert(reports).values({ reporterId: user.id, targetType: d.targetType, targetId: d.targetId, reason: d.reason, details: d.details || null });
}

// ---------- Reads ----------

export async function getListingDetail(id: number, viewer: SessionUser | null, countView = true) {
  const [row] = await db
    .select({ l: listings, seller: users })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(listings.id, id));
  if (!row) return null;
  const isOwner = !!viewer && (viewer.id === row.l.userId || viewer.role === "admin");
  if ((row.l.status === "removed" || row.l.status === "hidden" || row.seller.isBanned) && !isOwner) return null;
  if (countView && !isOwner) await db.update(listings).set({ views: sql`${listings.views} + 1` }).where(eq(listings.id, id));
  const [fav, similar] = await Promise.all([
    viewer ? db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.userId, viewer.id), eq(favorites.listingId, id))) : [],
    db
      .select({ l: listings, seller: { name: users.name, verificationStatus: users.verificationStatus } })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.userId))
      .where(and(eq(listings.status, "active"), eq(listings.category, row.l.category), ne(listings.id, id), eq(users.isBanned, false)))
      .orderBy(sql`(case when ${listings.city} = ${row.l.city} then 0 else 1 end)`, desc(listings.createdAt))
      .limit(6),
  ]);
  const s = row.seller;
  return {
    listing: row.l,
    seller: {
      id: s.id,
      name: s.name,
      city: s.city,
      role: s.role,
      verificationStatus: s.verificationStatus,
      createdAt: s.createdAt,
      // Contact details only for signed-in users, as on the website.
      phone: viewer ? s.phone : null,
      whatsapp: viewer ? (s.whatsapp ?? s.phone) : null,
    },
    isOwner,
    isFavorite: fav.length > 0,
    similar: similar.map((r) => ({ ...r.l, seller: r.seller })),
  };
}

export async function myListings(userId: number): Promise<Listing[]> {
  return db
    .select()
    .from(listings)
    .where(and(eq(listings.userId, userId), ne(listings.status, "removed")))
    .orderBy(desc(listings.createdAt));
}

export async function myFavorites(userId: number) {
  const rows = await db
    .select({ l: listings, seller: { name: users.name, verificationStatus: users.verificationStatus } })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return rows.filter((r) => r.l.status === "active" || r.l.status === "sold").map((r) => ({ ...r.l, seller: r.seller }));
}
