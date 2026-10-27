// Regression tests for the issues found in the independent security review.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { listings, phoneOtps, plans, products, providers, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { clientIp, resetRateLimits } from "@/lib/api/http";

const uploadDir = mkdtempSync(path.join(tmpdir(), "halali-sec-"));
process.env.UPLOAD_DIR = uploadDir;
process.env.PUSH_DISABLED = "1";
const { handleApiRequest } = await import("@/lib/api/handle");

const BASE = "http://test.local/api/v1";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
type Res = { status: number; body: { data?: unknown; error?: { code: string; message: string } } };

async function call(method: string, p: string, opts: { token?: string; json?: unknown; form?: FormData; ip?: string; raw?: boolean } = {}): Promise<Res> {
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

async function makeUser(phone: string, role: "user" | "trader" | "vet" | "shop" = "user", balance = 0) {
  const [u] = await db
    .insert(users)
    .values({ name: `مستخدم ${phone.slice(-4)}`, phone, passwordHash: await hashPassword("secret123"), city: "anbar", role, verificationStatus: "verified", walletBalance: balance })
    .returning();
  return u;
}
async function login(phone: string, password = "secret123") {
  const r = await call("POST", "/auth/login", { json: { phone, password } });
  expect(r.status).toBe(200);
  return data(r).token as string;
}
async function upload(token: string, isPrivate = false) {
  const form = new FormData();
  form.set("file", new Blob([JPEG], { type: "image/jpeg" }), "a.jpg");
  return data(await call("POST", `/uploads${isPrivate ? "?private=1" : ""}`, { token, form })).url as string;
}

beforeEach(async () => {
  resetRateLimits();
  delete process.env.SMS_PROVIDER;
  await db.execute(sql`truncate users, settings, plans, phone_otps, security_events, uploads restart identity cascade`);
});
afterAll(async () => {
  rmSync(uploadDir, { recursive: true, force: true });
  await pool.end();
});

describe("brute force", () => {
  it("uses the proxy-appended IP, not the client-supplied one", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" } }))).toBe("203.0.113.9");
  });

  it("locks an account after 10 failures, whatever the phone spelling or IP", async () => {
    await makeUser("07810000007");
    const spellings = ["07810000007", "7810000007", "+9647810000007", "009647810000007", "0781 000 0007", "(0781) 000-0007"];
    for (let i = 0; i < 10; i++)
      await call("POST", "/auth/login", { json: { phone: spellings[i % spellings.length], password: "wrong" }, ip: `1.1.1.${i}` });
    const r = await call("POST", "/auth/login", { json: { phone: "07810000007", password: "secret123" }, ip: "9.9.9.9" });
    expect(r.status).toBe(400);
    expect(r.body.error?.message).toContain("محاولات دخول كثيرة");
  });

  it("cannot exceed the SMS code attempt limit with parallel guesses", async () => {
    process.env.SMS_PROVIDER = "log";
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await call("POST", "/auth/otp/request", { json: { phone: "07501112222", purpose: "register" } });
    const code = /حلالي: (\d{6})/.exec(String(log.mock.calls.at(-1)?.[0]))![1];
    log.mockRestore();
    const wrong = code === "000000" ? "111111" : "000000";
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => call("POST", "/auth/otp/verify", { json: { phone: "07501112222", code: wrong }, ip: `2.2.2.${i}` })),
    );
    const [row] = await db.select().from(phoneOtps);
    expect(row.attempts).toBeLessThanOrEqual(5);
    const right = await call("POST", "/auth/otp/verify", { json: { phone: "07501112222", code } });
    expect(right.status).toBe(400); // used up
  });
});

describe("data exposure", () => {
  it("hides vet and shop phone numbers from signed-out users in lists", async () => {
    const vet = await makeUser("07810000001", "vet");
    await db.insert(providers).values({ userId: vet.id, kind: "vet", businessName: "عيادة", city: "anbar", phone: "07810000001", whatsapp: "07810000001" });
    const list = data(await call("GET", "/providers?kind=vet"));
    expect(list[0].phone).toBeNull();
    expect(data(await call("GET", "/home")).vets[0].phone).toBeNull();
    const t = await login("07810000001");
    expect(data(await call("GET", "/providers?kind=vet", { token: t }))[0].phone).toBe("07810000001");
  });
});

describe("moderation", () => {
  it("owner cannot re-publish a listing the admin took down", async () => {
    const u = await makeUser("07711111111", "trader");
    const t = await login(u.phone);
    const img = await upload(t);
    const l = data(await call("POST", "/listings", { token: t, json: { category: "sheep", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة جداً", city: "anbar", images: [img] } }));
    await db.update(listings).set({ status: "removed", moderatedAt: new Date() }).where(eq(listings.id, l.id));
    const r = await call("POST", `/listings/${l.id}/status`, { token: t, json: { status: "active" } });
    expect(r.status).toBe(400);
  });
});

describe("races", () => {
  it("parallel featuring charges and extends consistently", async () => {
    const u = await makeUser("07722222222", "trader", 100_000);
    const t = await login(u.phone);
    const img = await upload(t);
    const l = data(await call("POST", "/listings", { token: t, json: { category: "sheep", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة جداً", city: "anbar", images: [img] } }));
    const rs = await Promise.all([1, 2, 3].map(() => call("POST", `/listings/${l.id}/feature`, { token: t })));
    const ok = rs.filter((r) => r.status === 200).length;
    const [after] = await db.select().from(listings).where(eq(listings.id, l.id));
    const days = (after.featuredUntil!.getTime() - Date.now()) / 86400_000;
    expect(Math.round(days)).toBe(7 * ok); // every charge bought 7 more days
    const [w] = await db.select().from(users).where(eq(users.id, u.id));
    expect(w.walletBalance).toBe(100_000 - 10_000 * ok);
  });

  it("an order is cancelled (and stock returned) only once", async () => {
    const shopUser = await makeUser("07799999999", "shop");
    const [shop] = await db.insert(providers).values({ userId: shopUser.id, kind: "shop", businessName: "محل", city: "anbar" }).returning();
    const [prod] = await db.insert(products).values({ providerId: shop.id, name: "علف", category: "feed", price: 1000, stock: 10 }).returning();
    await makeUser("07700000002");
    const buyer = await login("07700000002");
    const o = data(await call("POST", `/providers/${shop.id}/orders`, { token: buyer, json: { items: [{ productId: prod.id, quantity: 4 }] } }));
    await Promise.all([1, 2, 3].map(() => call("POST", `/orders/${o.id}/status`, { token: buyer, json: { status: "cancelled" } })));
    const [p] = await db.select().from(products).where(eq(products.id, prod.id));
    expect(p.stock).toBe(10);
  });

  it("parallel sign-ups with one number give one account and clean errors", async () => {
    const body = { name: "علي حسن", phone: "07701234567", password: "secret123", city: "baghdad" };
    const rs = await Promise.all([1, 2, 3].map((i) => call("POST", "/auth/register", { json: body, ip: `3.3.3.${i}` })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.every((r) => r.status === 201 || r.status === 400)).toBe(true);
  });

  it("plan limits hold under parallel creates", async () => {
    const u = await makeUser("07733333333");
    const t = await login(u.phone);
    const imgs = await Promise.all([1, 2, 3, 4, 5].map(() => upload(t)));
    const rs = await Promise.all(
      imgs.map((img) => call("POST", "/listings", { token: t, json: { category: "goats", title: "ماعز شامي للبيع", description: "ماعز شامي بصحة جيدة", city: "anbar", images: [img] } })),
    );
    expect(rs.filter((r) => r.status === 201)).toHaveLength(3); // free plan allows 3
  });

  it("parallel subscriptions extend once per charge", async () => {
    const u = await makeUser("07744444444", "trader", 100_000);
    const t = await login(u.phone);
    const [plan] = await db.insert(plans).values({ slug: "basic", name: "أساسي", role: "trader", priceMonthly: 15000 }).returning();
    const rs = await Promise.all([1, 2].map(() => call("POST", "/me/subscription", { token: t, json: { planId: plan.id } })));
    const ok = rs.filter((r) => r.status === 200).length;
    const ends = rs.filter((r) => r.status === 200).map((r) => new Date(data(r).endsAt).getTime());
    const months = (Math.max(...ends) - Date.now()) / (30 * 86400_000);
    expect(Math.round(months)).toBe(ok);
  });
});

describe("sessions", () => {
  it("changing the password signs out other devices", async () => {
    const u = await makeUser("07755555555");
    const phone = await login(u.phone);
    const tablet = await login(u.phone);
    expect((await call("POST", "/me/password", { token: phone, json: { current: "secret123", next: "newsecret123" } })).status).toBe(200);
    expect((await call("GET", "/me", { token: phone })).status).toBe(200);
    expect((await call("GET", "/me", { token: tablet })).status).toBe(401);
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(1);
  });
});

describe("bad input returns 400, not 500", () => {
  it("handles huge ids, numbers and malformed paths", async () => {
    const u = await makeUser("07766666666", "trader");
    const t = await login(u.phone);
    for (const p of ["/listings/99999999999", "/auctions/99999999999", "/users/99999999999", "/providers/99999999999"])
      expect((await call("GET", p)).status).toBe(400);
    expect((await call("POST", "/reports", { token: t, json: { targetType: "listing", targetId: 99999999999, reason: "fraud" } })).status).toBe(400);
    expect((await call("POST", "/me/notifications/read", { token: t, json: { ids: [99999999999] } })).status).toBe(200);
    expect((await call("POST", "/me/subscription", { token: t, json: { planId: 99999999999 } })).status).toBe(400);
    const img = await upload(t);
    const l = data(await call("POST", "/listings", { token: t, json: { category: "sheep", title: "خراف عواسي للبيع", description: "خراف بصحة ممتازة جداً", city: "anbar", images: [img] } }));
    expect((await call("PATCH", `/listings/${l.id}`, { token: t, json: { ageMonths: 1e10 } })).status).toBe(400);
    const bad = await handleApiRequest(new Request(BASE + "/listings/%E0"));
    expect(bad.status).toBe(404);
    expect(bad.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("ownership", () => {
  it("a deleted product cannot be revived by editing it", async () => {
    const s = await makeUser("07788888888", "shop");
    await db.insert(providers).values({ userId: s.id, kind: "shop", businessName: "محل", city: "anbar" });
    const t = await login(s.phone);
    const p = data(await call("POST", "/me/business/products", { token: t, json: { name: "علف", category: "feed", price: 1000, stock: 1 } }));
    await call("DELETE", `/me/business/products/${p.id}`, { token: t });
    expect((await call("PATCH", `/me/business/products/${p.id}`, { token: t, json: { price: 2000 } })).status).toBe(400);
  });

  it("nobody can attach another user's upload", async () => {
    await makeUser("07712121212");
    await makeUser("07713131313");
    await db.update(users).set({ verificationStatus: "none" });
    const a = await login("07712121212");
    const b = await login("07713131313");
    const doc = await upload(a, true);
    const r = await call("POST", "/me/verification", { token: b, json: { fullName: "مستخدم تجريبي كامل", documentType: "national_id", documentImages: [doc] } });
    expect(r.status).toBe(400);
    expect((await call("POST", "/me/verification", { token: a, json: { fullName: "مستخدم تجريبي كامل", documentType: "national_id", documentImages: [doc] } })).status).toBe(201);
  });
});
