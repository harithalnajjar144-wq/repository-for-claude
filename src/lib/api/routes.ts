/**
 * Mobile API v1 — every endpoint, in one table.
 * Handlers are thin: they read the request, call the shared services in src/lib, and shape the response.
 */
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { ads, auctions, listings, plans, providers, users, type Auction, type Provider } from "@/db/schema";
import { issueSessionToken, revokeSessionToken } from "../auth";
import { cancelAuction, completeAuction, joinAuction, placeBid, settleDueAuctions } from "../auctions";
import {
  AUCTION_DURATIONS,
  ANIMAL_CATEGORIES,
  AUCTION_STATUS_LABELS,
  BOOKING_STATUS_LABELS,
  GENDER_LABELS,
  GOVERNORATES,
  ORDER_STATUS_LABELS,
  PRODUCT_CATEGORIES,
  REPORT_REASONS,
  ROLE_LABELS,
  TOPUP_METHODS,
  TX_TYPE_LABELS,
  VERIFICATION_LABELS,
  VET_SPECIALTIES,
} from "../constants";
import { UserError } from "../errors";
import { otpRequired, requestOtp, verifyOtp } from "../otp";
import { getActiveSubscription, subscribe } from "../plans";
import { registerPushToken, removePushToken } from "../push";
import { latestListings, listAuctions, listProviders, searchListings } from "../queries";
import { getSettings } from "../settings";
import { assertUploadedImages, storeImage, MAX_IMAGE_BYTES } from "../uploads";
import * as account from "../services/account";
import * as listingSvc from "../services/listings";
import * as auctionSvc from "../services/auctions";
import * as providerSvc from "../services/providers";
import { ApiError, MAX_ID, created, intParam, notFound, ok, pageParam, rateLimit, strArray, type AuthedCtx, type Ctx } from "./http";

type Route = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  auth: "required" | "optional";
  handler: (ctx: Ctx) => Promise<unknown>;
};

const routes: Route[] = [];
const pub = (method: Route["method"], path: string, handler: (ctx: Ctx) => Promise<unknown>) =>
  routes.push({ method, path, auth: "optional", handler });
const priv = (method: Route["method"], path: string, handler: (ctx: AuthedCtx) => Promise<unknown>) =>
  routes.push({ method, path, auth: "required", handler: handler as (ctx: Ctx) => Promise<unknown> });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const publicAuction = ({ reservePrice, ...a }: Auction) => a;

/** Contact numbers only for signed-in users, as on the website. */
const publicProvider = (p: Provider, verificationStatus: string, signedIn: boolean) => ({
  ...p,
  verificationStatus,
  phone: signedIn ? p.phone : null,
  whatsapp: signedIn ? p.whatsapp : null,
});

async function session(ctx: Ctx, userId: number) {
  const b = await ctx.body();
  const { token, expiresAt } = await issueSessionToken(userId, "mobile", typeof b.deviceName === "string" ? b.deviceName : null);
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  return { token, expiresAt, user: account.publicUser(u) };
}

// =================== App data ===================

pub("GET", "/health", async () => {
  await db.execute(sql`select 1`);
  return { status: "ok", time: new Date().toISOString() };
});

pub("GET", "/meta", async () => {
  const s = await getSettings();
  return {
    minAppVersion: process.env.MIN_APP_VERSION ?? "1.0.0",
    otpRequired: otpRequired(),
    governorates: GOVERNORATES,
    animalCategories: ANIMAL_CATEGORIES,
    productCategories: PRODUCT_CATEGORIES,
    vetSpecialties: VET_SPECIALTIES,
    reportReasons: REPORT_REASONS,
    topupMethods: TOPUP_METHODS,
    auctionDurations: AUCTION_DURATIONS,
    labels: {
      roles: ROLE_LABELS,
      genders: GENDER_LABELS,
      auctionStatus: AUCTION_STATUS_LABELS,
      bookingStatus: BOOKING_STATUS_LABELS,
      orderStatus: ORDER_STATUS_LABELS,
      verification: VERIFICATION_LABELS,
      txTypes: TX_TYPE_LABELS,
    },
    settings: {
      auctionCommissionRate: s.auctionCommissionRate,
      minDepositRate: s.minDepositRate,
      minDepositAmount: s.minDepositAmount,
      antiSnipeSeconds: s.antiSnipeSeconds,
      antiSnipeExtendSeconds: s.antiSnipeExtendSeconds,
      forfeitSellerShare: s.forfeitSellerShare,
      freeActiveListings: s.freeActiveListings,
      freeActiveAuctions: s.freeActiveAuctions,
      featuredListingPrice: s.featuredListingPrice,
      requireVerificationForAuctions: s.requireVerificationForAuctions,
      supportPhone: s.supportPhone,
      zaincashNumber: s.zaincashNumber,
    },
  };
});

pub("GET", "/home", async () => {
  await settleDueAuctions();
  const [latest, live, vets, shops, [ad], [stats]] = await Promise.all([
    latestListings(10),
    listAuctions({ status: "active", limit: 6 }),
    listProviders("vet", { limit: 4 }),
    listProviders("shop", { limit: 4 }),
    db
      .select()
      .from(ads)
      .where(and(eq(ads.isActive, true), eq(ads.placement, "home_top"), or(isNull(ads.endsAt), gt(ads.endsAt, new Date()))))
      .orderBy(sql`random()`)
      .limit(1),
    db
      .select({
        listings: sql<number>`(select count(*)::int from ${listings} where ${listings.status} = 'active')`,
        auctions: sql<number>`(select count(*)::int from ${auctions} where ${auctions.status} in ('scheduled','live'))`,
        verified: sql<number>`(select count(*)::int from ${users} where ${users.verificationStatus} = 'verified')`,
        providers: sql<number>`(select count(*)::int from ${providers} where ${providers.isActive})`,
      })
      .from(sql`(select 1) as x`),
  ]);
  if (ad) await db.update(ads).set({ impressions: sql`${ads.impressions} + 1` }).where(eq(ads.id, ad.id));
  return {
    stats,
    liveAuctions: live.map((a) => ({ ...publicAuction(a), seller: a.seller })),
    latestListings: latest,
    vets: vets.map((r) => publicProvider(r.p, r.verificationStatus, false)),
    shops: shops.map((r) => publicProvider(r.p, r.verificationStatus, false)),
    ad: ad ? { id: ad.id, title: ad.title, subtitle: ad.subtitle, imageUrl: ad.imageUrl, clickUrl: `/api/ads/${ad.id}/click` } : null,
  };
});

/** Upload one image (multipart field "file"). ?private=1 for ID documents and receipts. */
priv("POST", "/uploads", async (ctx) => {
  rateLimit(`upload:${ctx.user.id}`, 60, 10 * 60_000);
  const len = Number(ctx.req.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES + 64 * 1024) throw new UserError("حجم الصورة يجب أن يكون أقل من 6 ميغابايت.");
  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    throw new ApiError(400, "bad_upload", "أرسل الصورة كملف (multipart/form-data) في الحقل file.");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new ApiError(400, "bad_upload", "أرسل الصورة في الحقل file.");
  if (file.size > MAX_IMAGE_BYTES) throw new UserError("حجم الصورة يجب أن يكون أقل من 6 ميغابايت.");
  const url = await storeImage(Buffer.from(await file.arrayBuffer()), { private: ctx.query.get("private") === "1", userId: ctx.user.id });
  return created({ url });
});

// =================== Auth ===================

pub("POST", "/auth/otp/request", async (ctx) => {
  const b = await ctx.body();
  rateLimit(`otp:${ctx.ip}`, 10, 3600_000);
  const purpose = b.purpose === "reset" ? "reset" : "register";
  return requestOtp(String(b.phone ?? ""), purpose);
});

pub("POST", "/auth/otp/verify", async (ctx) => {
  const b = await ctx.body();
  rateLimit(`otpv:${ctx.ip}`, 30, 3600_000);
  return verifyOtp(String(b.phone ?? ""), b.purpose === "reset" ? "reset" : "register", String(b.code ?? ""));
});

pub("POST", "/auth/register", async (ctx) => {
  rateLimit(`register:${ctx.ip}`, 10, 3600_000);
  const u = await account.registerUser(await ctx.body());
  return created(await session(ctx, u.id));
});

pub("POST", "/auth/login", async (ctx) => {
  const b = await ctx.body();
  rateLimit(`login:${ctx.ip}`, 20, 15 * 60_000);
  const u = await account.authenticate(String(b.phone ?? ""), String(b.password ?? ""));
  return session(ctx, u.id);
});

pub("POST", "/auth/password/reset", async (ctx) => {
  const b = await ctx.body();
  rateLimit(`reset:${ctx.ip}`, 10, 3600_000);
  const u = await account.resetPassword(String(b.phone ?? ""), String(b.otpToken ?? ""), String(b.password ?? ""));
  return session(ctx, u.id);
});

priv("POST", "/auth/logout", async (ctx) => {
  const b = await ctx.body();
  if (typeof b.pushToken === "string") await removePushToken(ctx.user.id, b.pushToken);
  if (ctx.token) await revokeSessionToken(ctx.token);
  return { loggedOut: true };
});

// =================== Me ===================

priv("GET", "/me", async (ctx) => account.getMe(ctx.user));
priv("PATCH", "/me", async (ctx) => (await account.updateProfile(ctx.user, await ctx.body())).user);
priv("POST", "/me/password", async (ctx) => {
  const b = await ctx.body();
  rateLimit(`pw:${ctx.user.id}`, 10, 15 * 60_000);
  await account.changePassword(ctx.user, String(b.current ?? ""), String(b.next ?? ""), ctx.token);
  return { changed: true };
});
priv("POST", "/me/verification", async (ctx) => {
  await account.requestVerification(ctx.user, await ctx.body());
  return created({ status: "pending" });
});
priv("POST", "/me/push-tokens", async (ctx) => {
  const b = await ctx.body();
  await registerPushToken(ctx.user.id, String(b.token ?? ""), String(b.platform ?? "android"));
  return { registered: true };
});
priv("DELETE", "/me/push-tokens", async (ctx) => {
  await removePushToken(ctx.user.id, String((await ctx.body()).token ?? ctx.query.get("token") ?? ""));
  return { removed: true };
});
priv("GET", "/me/notifications", async (ctx) => account.listNotifications(ctx.user.id, pageParam(ctx.query)));
priv("POST", "/me/notifications/read", async (ctx) => {
  const b = await ctx.body();
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= MAX_ID) : undefined;
  return { marked: await account.markNotificationsRead(ctx.user.id, ids) };
});
priv("GET", "/me/listings", async (ctx) => listingSvc.myListings(ctx.user.id));
priv("GET", "/me/favorites", async (ctx) => listingSvc.myFavorites(ctx.user.id));
priv("GET", "/me/auctions", async (ctx) => {
  await settleDueAuctions();
  return auctionSvc.myAuctions(ctx.user.id);
});
priv("GET", "/me/bookings", async (ctx) => providerSvc.myBookings(ctx.user.id));
priv("GET", "/me/orders", async (ctx) => providerSvc.myOrders(ctx.user.id));

// =================== Wallet & plans ===================

priv("GET", "/me/wallet", async (ctx) => account.getWallet(ctx.user.id));
priv("POST", "/me/wallet/topups", async (ctx) => {
  rateLimit(`topup:${ctx.user.id}`, 10, 3600_000);
  const r = await account.requestTopup(ctx.user, await ctx.body());
  return created(r.topup, { message: r.message });
});
pub("GET", "/plans", async (ctx) => {
  const rows = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.role), asc(plans.sortOrder));
  const role = ctx.query.get("role") ?? ctx.user?.role;
  return role && role !== "admin" ? rows.filter((p) => p.role === role) : rows;
});
priv("GET", "/me/subscription", async (ctx) => {
  const s = await getActiveSubscription(ctx.user.id);
  return s ? { plan: s.plan, startsAt: s.sub.startsAt, endsAt: s.sub.endsAt } : null;
});
priv("POST", "/me/subscription", async (ctx) => {
  const b = await ctx.body();
  const months = [1, 3, 6, 12].includes(Number(b.months)) ? Number(b.months) : 1;
  const endsAt = await subscribe(ctx.user.id, intParam(String(b.planId), "الباقة"), months);
  return { endsAt };
});

// =================== Listings ===================

pub("GET", "/listings", async (ctx) => {
  const q = ctx.query;
  const r = await searchListings({
    q: q.get("q") ?? undefined,
    category: q.get("category") ?? undefined,
    city: q.get("city") ?? undefined,
    type: q.get("type") ?? undefined,
    minPrice: q.get("minPrice") ?? undefined,
    maxPrice: q.get("maxPrice") ?? undefined,
    sort: q.get("sort") ?? undefined,
    verified: q.get("verified") ?? undefined,
    page: String(pageParam(q)),
  });
  return ok(r.items, { page: r.page, totalPages: r.totalPages, total: r.total });
});

pub("GET", "/listings/:id", async (ctx) => {
  const d = await listingSvc.getListingDetail(intParam(ctx.params.id), ctx.user);
  if (!d) throw notFound("الإعلان");
  return d;
});

priv("POST", "/listings", async (ctx) => {
  const b = await ctx.body();
  const images = await listingSvc.resolveListingImages(ctx.user.id, strArray(b.images));
  return created(await listingSvc.createListing(ctx.user, b, images));
});

priv("PATCH", "/listings/:id", async (ctx) => {
  const id = intParam(ctx.params.id);
  const current = await listingSvc.getOwnListing(ctx.user, id);
  const b = await ctx.body();
  const images = b.images === undefined ? current.images : await listingSvc.resolveListingImages(ctx.user.id, strArray(b.images), current.images);
  // PATCH semantics: start from the current values.
  return listingSvc.updateListing(ctx.user, id, { ...current, ...b }, images);
});

priv("POST", "/listings/:id/status", async (ctx) =>
  listingSvc.setListingStatus(ctx.user, intParam(ctx.params.id), (await ctx.body()).status),
);
priv("POST", "/listings/:id/feature", async (ctx) => ({ featuredUntil: await listingSvc.featureListing(ctx.user, intParam(ctx.params.id)) }));
priv("PUT", "/listings/:id/favorite", async (ctx) => ({ favorite: await listingSvc.setFavorite(ctx.user.id, intParam(ctx.params.id), true) }));
priv("DELETE", "/listings/:id/favorite", async (ctx) => ({ favorite: await listingSvc.setFavorite(ctx.user.id, intParam(ctx.params.id), false) }));

// =================== Auctions ===================

pub("GET", "/auctions", async (ctx) => {
  await settleDueAuctions();
  const page = pageParam(ctx.query);
  const items = await listAuctions({
    status: ctx.query.get("status") === "ended" ? "ended" : "active",
    category: ctx.query.get("category") ?? undefined,
    city: ctx.query.get("city") ?? undefined,
    limit: 24,
    page,
  });
  return ok(items.map((a) => ({ ...publicAuction(a), seller: a.seller })), { page });
});

pub("GET", "/auctions/:id", async (ctx) => {
  const d = await auctionSvc.getAuctionDetail(intParam(ctx.params.id), ctx.user);
  if (!d) throw notFound("المزاد");
  return d;
});

/** Light endpoint for polling while the auction screen is open. */
pub("GET", "/auctions/:id/state", async (ctx) => {
  const { getAuctionState } = await import("../auctionState");
  const s = await getAuctionState(intParam(ctx.params.id), ctx.user?.id);
  if (!s) throw notFound("المزاد");
  return s;
});

priv("POST", "/auctions", async (ctx) => {
  const b = await ctx.body();
  const images = await assertUploadedImages(strArray(b.images), { max: 8, userId: ctx.user.id });
  return created(await auctionSvc.createAuction(ctx.user, b, images));
});

priv("POST", "/auctions/:id/join", async (ctx) => {
  rateLimit(`join:${ctx.user.id}`, 30, 60_000);
  const dep = await joinAuction(ctx.user.id, intParam(ctx.params.id));
  return { deposit: dep };
});

priv("POST", "/auctions/:id/bids", async (ctx) => {
  rateLimit(`bid:${ctx.user.id}`, 30, 60_000);
  const amount = Number(String((await ctx.body()).amount ?? "").replace(/[,\s]/g, ""));
  return created(await placeBid(ctx.user.id, intParam(ctx.params.id), amount));
});

priv("POST", "/auctions/:id/complete", async (ctx) => {
  await completeAuction(ctx.user.id, intParam(ctx.params.id), ctx.user.role === "admin");
  return { status: "completed" };
});

priv("POST", "/auctions/:id/cancel", async (ctx) => {
  await cancelAuction(ctx.user.id, intParam(ctx.params.id), ctx.user.role === "admin");
  return { status: "cancelled" };
});

// =================== Vets & shops ===================

pub("GET", "/providers", async (ctx) => {
  const kind = ctx.query.get("kind") === "shop" ? "shop" : "vet";
  const rows = await listProviders(kind, { city: ctx.query.get("city") ?? undefined, q: ctx.query.get("q") ?? undefined });
  return rows.map((r) => publicProvider(r.p, r.verificationStatus, !!ctx.user));
});

pub("GET", "/providers/:id", async (ctx) => {
  const d = await providerSvc.getProviderDetail(intParam(ctx.params.id));
  if (!d) throw notFound("الملف");
  const p = d.provider;
  return {
    ...d,
    // Contact numbers only for signed-in users, as on the website.
    provider: { ...p, phone: ctx.user ? p.phone : null, whatsapp: ctx.user ? p.whatsapp : null },
  };
});

priv("POST", "/providers/:id/bookings", async (ctx) =>
  created(await providerSvc.createBooking(ctx.user, { ...(await ctx.body()), providerId: intParam(ctx.params.id) })),
);
priv("POST", "/providers/:id/orders", async (ctx) =>
  created(await providerSvc.createOrder(ctx.user, { ...(await ctx.body()), providerId: intParam(ctx.params.id) })),
);
priv("POST", "/bookings/:id/status", async (ctx) => {
  const b = await ctx.body();
  return providerSvc.updateBookingStatus(ctx.user, intParam(ctx.params.id), String(b.status ?? ""), typeof b.note === "string" ? b.note : null);
});
priv("POST", "/orders/:id/status", async (ctx) =>
  providerSvc.updateOrderStatus(ctx.user, intParam(ctx.params.id), String((await ctx.body()).status ?? "")),
);

// =================== My business (vets & shops) ===================

priv("GET", "/me/business", async (ctx) => providerSvc.myBusiness(ctx.user));
priv("PATCH", "/me/business", async (ctx) => {
  const current = await providerSvc.getMyProvider(ctx.user);
  const b = await ctx.body();
  let logo: string | null | undefined = undefined;
  if (typeof b.logo === "string") [logo] = await assertUploadedImages([b.logo], { max: 1, userId: ctx.user.id });
  else if (b.logo === null) logo = null;
  return providerSvc.updateProvider(ctx.user, { ...current, ...b }, logo);
});
priv("POST", "/me/business/services", async (ctx) => created(await providerSvc.saveService(ctx.user, { ...(await ctx.body()), id: undefined })));
priv("PATCH", "/me/business/services/:id", async (ctx) =>
  providerSvc.saveService(ctx.user, { ...(await ctx.body()), id: intParam(ctx.params.id) }),
);
priv("DELETE", "/me/business/services/:id", async (ctx) => {
  await providerSvc.deleteService(ctx.user, intParam(ctx.params.id));
  return { deleted: true };
});
priv("POST", "/me/business/products", async (ctx) => {
  const b = await ctx.body();
  const images = await assertUploadedImages(strArray(b.images), { max: 4, userId: ctx.user.id });
  return created(await providerSvc.saveProduct(ctx.user, { ...b, id: undefined }, images));
});
priv("PATCH", "/me/business/products/:id", async (ctx) => {
  const id = intParam(ctx.params.id);
  const current = await providerSvc.getMyProduct(ctx.user, id);
  const b = await ctx.body();
  let images = current.images;
  if (b.images !== undefined) {
    const urls = strArray(b.images);
    const added = await assertUploadedImages(urls.filter((u) => !current.images.includes(u)), { max: 4, userId: ctx.user.id });
    images = urls.filter((u) => current.images.includes(u) || added.includes(u));
  }
  return providerSvc.saveProduct(ctx.user, { ...current, ...b, id }, images);
});
priv("DELETE", "/me/business/products/:id", async (ctx) => {
  await providerSvc.deleteProduct(ctx.user, intParam(ctx.params.id));
  return { deleted: true };
});
priv("GET", "/me/business/bookings", async (ctx) => providerSvc.businessBookings(ctx.user));
priv("GET", "/me/business/orders", async (ctx) => providerSvc.businessOrders(ctx.user));

// =================== Other ===================

priv("POST", "/reports", async (ctx) => {
  rateLimit(`report:${ctx.user.id}`, 20, 3600_000);
  await listingSvc.createReport(ctx.user, await ctx.body());
  return created({ received: true });
});

pub("GET", "/users/:id", async (ctx) => {
  const id = intParam(ctx.params.id);
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || u.isBanned) throw notFound("المستخدم");
  const seller = { name: u.name, verificationStatus: u.verificationStatus };
  const [ls, as, [{ n }]] = await Promise.all([
    db.select().from(listings).where(and(eq(listings.userId, id), eq(listings.status, "active"))).orderBy(desc(listings.createdAt)).limit(48),
    db.select().from(auctions).where(and(eq(auctions.sellerId, id), inArray(auctions.status, ["scheduled", "live"]))).limit(12),
    db.select({ n: count() }).from(listings).where(and(eq(listings.userId, id), eq(listings.status, "active"))),
  ]);
  return {
    user: { id: u.id, name: u.name, role: u.role, city: u.city, bio: u.bio, verificationStatus: u.verificationStatus, createdAt: u.createdAt },
    activeListingCount: n,
    listings: ls.map((l) => ({ ...l, seller })),
    auctions: as.map((a) => ({ ...publicAuction(a), seller })),
  };
});

// =================== Router ===================

const compiled = routes.map((r) => {
  const names: string[] = [];
  const re = new RegExp("^" + r.path.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)")) + "/?$");
  return { ...r, re, names };
});

export function match(method: string, path: string) {
  let pathMatched = false;
  for (const r of compiled) {
    const m = r.re.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Record<string, string> = {};
    try {
      r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
    } catch {
      return null; // malformed %-encoding
    }
    return { route: r, params };
  }
  return pathMatched ? "method_not_allowed" : null;
}

export const routeTable = routes.map((r) => `${r.method} ${r.path}`);
