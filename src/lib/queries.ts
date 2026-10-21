import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auctions, listings, providers, users } from "@/db/schema";

const sellerCols = {
  name: users.name,
  verificationStatus: users.verificationStatus,
};

export type ListingFilters = {
  q?: string;
  category?: string;
  city?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  verified?: string;
  page?: string;
};

export const PAGE_SIZE = 24;

export async function searchListings(f: ListingFilters) {
  const where: SQL[] = [eq(listings.status, "active"), eq(users.isBanned, false)];
  if (f.q?.trim()) {
    const term = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    where.push(or(ilike(listings.title, term), ilike(listings.description, term), ilike(listings.breed, term))!);
  }
  if (f.category) where.push(eq(listings.category, f.category));
  if (f.city) where.push(eq(listings.city, f.city));
  if (f.type === "offer" || f.type === "wanted") where.push(eq(listings.type, f.type));
  const min = Number(f.minPrice);
  const max = Number(f.maxPrice);
  if (f.minPrice && Number.isFinite(min)) where.push(gte(listings.price, min));
  if (f.maxPrice && Number.isFinite(max)) where.push(lte(listings.price, max));
  if (f.verified === "1") where.push(eq(users.verificationStatus, "verified"));

  const featuredFirst = sql`(case when ${listings.featuredUntil} > now() then 0 else 1 end)`;
  const order =
    f.sort === "price_asc"
      ? [asc(sql`${listings.price} nulls last`)]
      : f.sort === "price_desc"
        ? [desc(sql`${listings.price} nulls last`)]
        : f.sort === "popular"
          ? [desc(listings.views)]
          : [featuredFirst, desc(listings.createdAt)];

  const page = Math.max(1, Number(f.page) || 1);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ l: listings, seller: sellerCols })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.userId))
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.userId))
      .where(and(...where)),
  ]);
  return {
    items: rows.map((r) => ({ ...r.l, seller: r.seller })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function latestListings(limit = 8) {
  const rows = await db
    .select({ l: listings, seller: sellerCols })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(and(eq(listings.status, "active"), eq(users.isBanned, false)))
    .orderBy(sql`(case when ${listings.featuredUntil} > now() then 0 else 1 end)`, desc(listings.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.l, seller: r.seller }));
}

export async function listAuctions(opts: { status?: "active" | "ended"; category?: string; city?: string; limit?: number; page?: number }) {
  const where: SQL[] = [];
  if (opts.status === "ended") where.push(inArray(auctions.status, ["ended", "completed", "unsold"]));
  else where.push(inArray(auctions.status, ["scheduled", "live"]));
  if (opts.category) where.push(eq(auctions.category, opts.category));
  if (opts.city) where.push(eq(auctions.city, opts.city));
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db
    .select({ a: auctions, seller: sellerCols })
    .from(auctions)
    .innerJoin(users, eq(users.id, auctions.sellerId))
    .where(and(...where))
    .orderBy(opts.status === "ended" ? desc(auctions.endsAt) : asc(auctions.endsAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return rows.map((r) => ({ ...r.a, seller: r.seller }));
}

export async function listProviders(kind: "vet" | "shop", f: { city?: string; q?: string; limit?: number }) {
  const where: SQL[] = [eq(providers.kind, kind), eq(providers.isActive, true), eq(users.isBanned, false)];
  if (f.city) where.push(eq(providers.city, f.city));
  if (f.q?.trim()) {
    const term = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    where.push(or(ilike(providers.businessName, term), ilike(providers.description, term))!);
  }
  const rows = await db
    .select({ p: providers, verificationStatus: users.verificationStatus })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(and(...where))
    .orderBy(sql`(case when ${users.verificationStatus} = 'verified' then 0 else 1 end)`, desc(providers.createdAt))
    .limit(f.limit ?? 60);
  return rows;
}
