import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { notifications, phoneOtps, plans, providers, pushTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { resetRateLimits } from "@/lib/api/http";

const uploadDir = mkdtempSync(path.join(tmpdir(), "halali-uploads-"));
process.env.UPLOAD_DIR = uploadDir;
process.env.PUSH_DISABLED = "1";

const { handleApiRequest } = await import("@/lib/api/handle");
const { deliverPendingPushes } = await import("@/lib/push");

const BASE = "http://test.local/api/v1";
// Smallest valid JPEG header is enough for the type sniffing.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

type Res = { status: number; body: { data?: unknown; error?: { code: string; message: string }; [k: string]: unknown } };

async function call(method: string, p: string, opts: { token?: string; json?: unknown; form?: FormData; ip?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = { "x-forwarded-for": opts.ip ?? "10.0.0.1" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) body = opts.form;
  const res = await handleApiRequest(new Request(BASE + p, { method, headers, body }));
  return { status: res.status, body: await res.json() };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (r: Res) => r.body.data as any;

async function makeUser(phone: string, role: "user" | "trader" | "vet" | "shop" = "user", opts: { verified?: boolean; balance?: number } = {}) {
  const [u] = await db
    .insert(users)
    .values({
      name: `مستخدم ${phone.slice(-4)}`,
      phone,
      passwordHash: await hashPassword("secret123"),
      city: "anbar",
      role,
      verificationStatus: opts.verified ? "verified" : "none",
      walletBalance: opts.balance ?? 0,
    })
    .returning();
  return u;
}

async function login(phone: string) {
  const r = await call("POST", "/auth/login", { json: { phone, password: "secret123", deviceName: "Pixel 8" } });
  expect(r.status).toBe(200);
  return data(r).token as string;
}

async function upload(token: string, isPrivate = false) {
  const form = new FormData();
  form.set("file", new Blob([JPEG], { type: "image/jpeg" }), "a.jpg");
  const r = await call("POST", `/uploads${isPrivate ? "?private=1" : ""}`, { token, form });
  expect(r.status).toBe(201);
  return data(r).url as string;
}

beforeAll(() => {
  delete process.env.SMS_PROVIDER;
});
beforeEach(async () => {
  resetRateLimits();
  delete process.env.SMS_PROVIDER;
  await db.execute(sql`truncate users, settings, plans, phone_otps restart identity cascade`);
});
afterAll(async () => {
  rmSync(uploadDir, { recursive: true, force: true });
  await pool.end();
});

describe("basics", () => {
  it("health, meta and unknown routes", async () => {
    expect((await call("GET", "/health")).status).toBe(200);
    const meta = await call("GET", "/meta");
    expect(data(meta).governorates.length).toBe(19);
    expect(data(meta).settings.auctionCommissionRate).toBe(0.03);
    expect((await call("GET", "/nope")).status).toBe(404);
    expect((await call("DELETE", "/meta")).status).toBe(405);
  });

  it("rejects bad JSON and anonymous access to private routes", async () => {
    const r = await handleApiRequest(new Request(BASE + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" }));
    expect(r.status).toBe(400);
    const me = await call("GET", "/me");
    expect(me.status).toBe(401);
    expect(me.body.error?.code).toBe("unauthorized");
  });
});

describe("auth", () => {
  it("registers, logs in, uses the token and logs out", async () => {
    const reg = await call("POST", "/auth/register", {
      json: { name: "علي حسن", phone: "0770 123 4567", password: "secret123", city: "baghdad", role: "trader" },
    });
    expect(reg.status).toBe(201);
    const { token, user } = data(reg);
    expect(user.phone).toBe("07701234567");
    expect(user.passwordHash).toBeUndefined();

    const me = await call("GET", "/me", { token });
    expect(data(me).user.name).toBe("علي حسن");

    const bad = await call("POST", "/auth/login", { json: { phone: "07701234567", password: "wrong-pass" } });
    expect(bad.status).toBe(400);

    const t2 = await login("07701234567");
    expect((await call("POST", "/auth/logout", { token: t2 })).status).toBe(200);
    expect((await call("GET", "/me", { token: t2 })).status).toBe(401);
    expect((await call("GET", "/me", { token })).status).toBe(200); // other session unaffected
  });

  it("creates the business profile for vets and blocks banned users", async () => {
    const reg = await call("POST", "/auth/register", {
      json: { name: "د. سارة", phone: "07801234567", password: "secret123", city: "basra", role: "vet", businessName: "عيادة سارة" },
    });
    const token = data(reg).token;
    expect(data(await call("GET", "/me/business", { token })).provider.businessName).toBe("عيادة سارة");
    await db.update(users).set({ isBanned: true }).where(eq(users.phone, "07801234567"));
    expect((await call("GET", "/me", { token })).status).toBe(401);
  });

  it("requires an SMS code when a provider is configured", async () => {
    process.env.SMS_PROVIDER = "log";
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const noCode = await call("POST", "/auth/register", { json: { name: "سامر علي", phone: "07501112222", password: "secret123", city: "anbar" } });
    expect(noCode.status).toBe(400);

    expect((await call("POST", "/auth/otp/request", { json: { phone: "07501112222", purpose: "register" } })).status).toBe(200);
    const code = /حلالي: (\d{6})/.exec(String(log.mock.calls.at(-1)?.[0]))![1];
    log.mockRestore();
    expect((await call("POST", "/auth/otp/request", { json: { phone: "07501112222" } })).status).toBe(400); // too soon

    const wrong = await call("POST", "/auth/otp/verify", { json: { phone: "07501112222", code: code === "000000" ? "111111" : "000000" } });
    expect(wrong.status).toBe(400);
    const ok = await call("POST", "/auth/otp/verify", { json: { phone: "07501112222", code } });
    const otpToken = data(ok).otpToken;

    const reg = await call("POST", "/auth/register", { json: { name: "سامر علي", phone: "07501112222", password: "secret123", city: "anbar", otpToken } });
    expect(reg.status).toBe(201);
    expect(data(reg).user.phoneVerifiedAt).toBeTruthy();
    // Token is single-use.
    const again = await call("POST", "/auth/register", { json: { name: "آخر", phone: "07501112222", password: "secret123", city: "anbar", otpToken } });
    expect(again.status).toBe(400);
    const rows = await db.select().from(phoneOtps);
    expect(rows[0].consumedAt).toBeTruthy();
  });
});

describe("listings", () => {
  it("creates with uploaded photos, searches, edits, favorites", async () => {
    await makeUser("07711111111", "trader");
    const token = await login("07711111111");
    const img = await upload(token);
    expect(img).toMatch(/^\/api\/files\/.+\.jpg$/);

    const noPhoto = await call("POST", "/listings", {
      token,
      json: { type: "offer", category: "sheep", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة ومطعمة", city: "anbar", quantity: 5 },
    });
    expect(noPhoto.status).toBe(400);
    const forged = await call("POST", "/listings", {
      token,
      json: { category: "sheep", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة ومطعمة", city: "anbar", images: ["/api/files/zzzz-0000000000000000.jpg"] },
    });
    expect(forged.status).toBe(400);

    const cr = await call("POST", "/listings", {
      token,
      json: { category: "sheep", breed: "عواسي", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة ومطعمة", price: 2500000, negotiable: true, quantity: 5, city: "anbar", images: [img] },
    });
    expect(cr.status).toBe(201);
    const id = data(cr).id;

    for (const sort of ["price_asc", "price_desc", "popular", ""])
      expect((await call("GET", `/listings?sort=${sort}`)).status).toBe(200);
    const search = await call("GET", "/listings?q=عواسي&city=anbar");
    expect(data(search)).toHaveLength(1);
    expect(search.body.totalPages).toBe(1);

    const anon = await call("GET", `/listings/${id}`);
    expect(data(anon).seller.phone).toBeNull();

    await makeUser("07722222222");
    const buyer = await login("07722222222");
    const seen = await call("GET", `/listings/${id}`, { token: buyer });
    expect(data(seen).seller.phone).toBe("07711111111");
    expect((await call("PUT", `/listings/${id}/favorite`, { token: buyer })).status).toBe(200);
    expect(data(await call("GET", "/me/favorites", { token: buyer }))).toHaveLength(1);
    expect((await call("PATCH", `/listings/${id}`, { token: buyer, json: { title: "سرقة الإعلان" } })).status).toBe(400);

    const patched = await call("PATCH", `/listings/${id}`, { token, json: { price: null, title: "خراف عواسي ممتازة" } });
    expect(data(patched).price).toBeNull();
    expect(data(patched).images).toEqual([img]);
    expect(data(patched).breed).toBe("عواسي");

    expect(data(await call("POST", `/listings/${id}/status`, { token, json: { status: "sold" } })).status).toBe("sold");
  });

  it("enforces the free listing limit", async () => {
    await makeUser("07733333333", "user");
    const token = await login("07733333333");
    const img = await upload(token);
    const body = { category: "goats", title: "ماعز شامي للبيع", description: "ماعز شامي بصحة جيدة", city: "baghdad", images: [img] };
    for (let i = 0; i < 3; i++) expect((await call("POST", "/listings", { token, json: body })).status).toBe(201);
    const fourth = await call("POST", "/listings", { token, json: body });
    expect(fourth.status).toBe(400);
    expect(fourth.body.error?.message).toContain("3");
  });
});

describe("auctions", () => {
  it("creates, joins, bids, hides the reserve and notifies the outbid user", async () => {
    await makeUser("07744444444", "trader", { verified: true });
    const seller = await login("07744444444");
    const img = await upload(seller);
    const cr = await call("POST", "/auctions", {
      token: seller,
      json: { title: "فحل عربي أصيل", description: "فحل بنسب موثق وشهادة صحية", category: "horses", city: "babil", startPrice: 1_000_000, reservePrice: 1_500_000, durationHours: 24, startMode: "now", images: [img] },
    });
    expect(cr.status).toBe(201);
    const id = data(cr).id;

    const u1 = await makeUser("07755555555", "user", { verified: true, balance: 500_000 });
    const u2 = await makeUser("07766666666", "user", { verified: true, balance: 500_000 });
    const t1 = await login(u1.phone);
    const t2 = await login(u2.phone);

    const pub = await call("GET", `/auctions/${id}`, { token: t1 });
    expect(data(pub).auction.reservePrice).toBeUndefined();
    expect(data(pub).state.minNext).toBe(1_000_000);
    expect(data(await call("GET", `/auctions/${id}`, { token: seller })).auction.reservePrice).toBe(1_500_000);

    expect((await call("POST", `/auctions/${id}/bids`, { token: t1, json: { amount: 1_000_000 } })).status).toBe(400); // no deposit
    expect((await call("POST", `/auctions/${id}/join`, { token: t1 })).status).toBe(200);
    expect((await call("POST", `/auctions/${id}/join`, { token: t2 })).status).toBe(200);
    expect((await call("POST", `/auctions/${id}/bids`, { token: t1, json: { amount: 1_000_000 } })).status).toBe(201);
    expect((await call("POST", `/auctions/${id}/bids`, { token: t2, json: { amount: "1,050,000" } })).status).toBe(201);

    const state = data(await call("GET", `/auctions/${id}/state`, { token: t1 }));
    expect(state.currentPrice).toBe(1_050_000);
    expect(state.bids[0].mine).toBe(false);
    expect(state.reserveMet).toBe(false);

    const notes = await db.select().from(notifications).where(eq(notifications.userId, u1.id));
    expect(notes.some((n) => n.title.includes("المزايدة"))).toBe(true);

    const wallet = data(await call("GET", "/me/wallet", { token: t1 }));
    expect(wallet.heldDeposits).toBe(50_000);
    expect(wallet.balance).toBe(450_000);

    const list = data(await call("GET", "/auctions"));
    expect(list[0].reservePrice).toBeUndefined();
    const mine = data(await call("GET", "/me/auctions", { token: t1 }));
    expect(mine.bidding[0].reservePrice).toBeUndefined();
  });

  it("only traders can open auctions", async () => {
    await makeUser("07777777777", "user", { verified: true });
    const t = await login("07777777777");
    const r = await call("POST", "/auctions", { token: t, json: { title: "مزاد", description: "وصف المزاد هنا", category: "sheep", city: "anbar", startPrice: 100000, durationHours: 1 } });
    expect(r.status).toBe(400);
  });
});

describe("vets, shops and push", () => {
  it("books a vet, orders from a shop, updates statuses and queues pushes", async () => {
    const vetUser = await makeUser("07788888888", "vet");
    const [vet] = await db.insert(providers).values({ userId: vetUser.id, kind: "vet", businessName: "عيادة", city: "anbar", homeVisits: true }).returning();
    const shopUser = await makeUser("07799999999", "shop");
    const [shop] = await db.insert(providers).values({ userId: shopUser.id, kind: "shop", businessName: "محل", city: "anbar", delivery: true }).returning();
    await makeUser("07700000002");
    const buyer = await login("07700000002");
    const shopToken = await login("07799999999");
    const vetToken = await login("07788888888");

    const svc = await call("POST", "/me/business/services", { token: vetToken, json: { name: "فحص عام", price: 25000 } });
    expect(svc.status).toBe(201);
    const prod = await call("POST", "/me/business/products", { token: shopToken, json: { name: "علف مركز", category: "feed", price: 30000, stock: 5 } });
    const productId = data(prod).id;

    const detail = data(await call("GET", `/providers/${vet.id}`));
    expect(detail.services).toHaveLength(1);
    expect(detail.provider.phone).toBeNull();

    const when = new Date(Date.now() + 2 * 86400_000).toISOString();
    const bk = await call("POST", `/providers/${vet.id}/bookings`, { token: buyer, json: { scheduledAt: when, animalType: "أغنام", animalCount: 10, homeVisit: true, serviceId: data(svc).id } });
    expect(bk.status).toBe(201);
    const bookingId = data(bk).id;
    expect((await call("POST", `/bookings/${bookingId}/status`, { token: buyer, json: { status: "confirmed" } })).status).toBe(400);
    expect(data(await call("POST", `/bookings/${bookingId}/status`, { token: vetToken, json: { status: "confirmed", note: "نصل الساعة 10" } })).status).toBe("confirmed");
    expect(data(await call("GET", "/me/bookings", { token: buyer }))[0].providerNote).toBe("نصل الساعة 10");

    const tooMany = await call("POST", `/providers/${shop.id}/orders`, { token: buyer, json: { items: [{ productId, quantity: 6 }] } });
    expect(tooMany.status).toBe(400);
    const ord = await call("POST", `/providers/${shop.id}/orders`, { token: buyer, json: { items: [{ productId, quantity: 2 }], fulfilment: "delivery", address: "الرمادي - حي الأندلس" } });
    expect(ord.status).toBe(201);
    expect(data(ord).total).toBe(60000);
    const orders = data(await call("GET", "/me/business/orders", { token: shopToken }));
    expect(orders[0].items[0].quantity).toBe(2);
    expect((await call("POST", `/orders/${data(ord).id}/status`, { token: buyer, json: { status: "cancelled" } })).status).toBe(200);
    expect(data(await call("GET", `/providers/${shop.id}`)).products[0].stock).toBe(5); // stock returned

    // Push: register a token, then the queue is claimed exactly once.
    expect((await call("POST", "/me/push-tokens", { token: shopToken, json: { token: "ExponentPushToken[abc123]", platform: "android" } })).status).toBe(200);
    expect((await call("POST", "/me/push-tokens", { token: shopToken, json: { token: "not-a-token" } })).status).toBe(400);
    expect(await db.select().from(pushTokens)).toHaveLength(1);
    const pending = await db.select().from(notifications).where(sql`${notifications.pushedAt} is null`);
    expect(pending.length).toBeGreaterThan(0);
    await deliverPendingPushes();
    expect(await db.select().from(notifications).where(sql`${notifications.pushedAt} is null`)).toHaveLength(0);
  });
});

describe("wallet and plans", () => {
  it("requests a top-up with a private receipt and subscribes", async () => {
    const u = await makeUser("07712121212", "trader", { balance: 100_000 });
    const token = await login(u.phone);
    const publicImg = await upload(token);
    expect((await call("POST", "/me/wallet/topups", { token, json: { amount: 50000, method: "zaincash", receiptImage: publicImg } })).status).toBe(400);
    const receipt = await upload(token, true);
    expect(receipt).toMatch(/^\/api\/private-files\//);
    const t = await call("POST", "/me/wallet/topups", { token, json: { amount: 50000, method: "zaincash", receiptImage: receipt } });
    expect(t.status).toBe(201);

    const [plan] = await db.insert(plans).values({ slug: "trader-basic", name: "أساسي", role: "trader", priceMonthly: 15000 }).returning();
    expect(data(await call("GET", "/plans", { token })).length).toBe(1);
    expect((await call("POST", "/me/subscription", { token, json: { planId: plan.id, months: 3 } })).status).toBe(200);
    expect(data(await call("GET", "/me/wallet", { token })).balance).toBe(55_000);
  });

  it("verification request needs a private document", async () => {
    const u = await makeUser("07713131313");
    const token = await login(u.phone);
    const doc = await upload(token, true);
    const r = await call("POST", "/me/verification", { token, json: { fullName: "مستخدم تجريبي كامل", documentType: "national_id", documentImages: [doc] } });
    expect(r.status).toBe(201);
    expect(data(await call("GET", "/me", { token })).user.verificationStatus).toBe("pending");
  });
});

describe("rate limits", () => {
  it("locks the account after repeated failed logins", async () => {
    await makeUser("07714141414");
    let last: Res | null = null;
    for (let i = 0; i < 11; i++) last = await call("POST", "/auth/login", { json: { phone: "07714141414", password: "nope-nope" }, ip: `10.1.0.${i}` });
    expect(last!.status).toBe(400);
    expect(last!.body.error?.message).toContain("محاولات دخول كثيرة");
  });
});

