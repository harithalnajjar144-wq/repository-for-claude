import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { auctionDeposits, auctions, users, walletTransactions } from "@/db/schema";
import {
  commissionFor,
  completeAuction,
  extendedEnd,
  forfeitWinner,
  joinAuction,
  minNextBid,
  placeBid,
  requiredDeposit,
  settleAuction,
} from "@/lib/auctions";

const H = 3600_000;

async function reset() {
  await db.execute(sql`truncate users, settings restart identity cascade`);
}

async function user(name: string, balance = 1_000_000, verified = true) {
  const [u] = await db
    .insert(users)
    .values({
      name,
      phone: `07${Math.floor(100000000 + Math.random() * 899999999)}`,
      passwordHash: "x",
      city: "anbar",
      role: "trader",
      verificationStatus: verified ? "verified" : "none",
      walletBalance: balance,
    })
    .returning();
  return u;
}

async function auction(sellerId: number, over: Partial<typeof auctions.$inferInsert> = {}) {
  const now = Date.now();
  const [a] = await db
    .insert(auctions)
    .values({
      sellerId,
      title: "فحل تجريبي",
      description: "اختبار",
      category: "horses",
      city: "anbar",
      startPrice: 1_000_000,
      minIncrement: 50_000,
      depositAmount: 100_000,
      commissionRate: "0.0300",
      startsAt: new Date(now - H),
      endsAt: new Date(now + H),
      status: "live",
      ...over,
    })
    .returning();
  return a;
}

const balance = async (id: number) => (await db.select().from(users).where(eq(users.id, id)))[0].walletBalance;
const getAuction = async (id: number) => (await db.select().from(auctions).where(eq(auctions.id, id)))[0];

beforeEach(reset);
afterAll(() => pool.end());

describe("pure rules", () => {
  it("computes the next minimum bid", () => {
    expect(minNextBid({ currentPrice: null, startPrice: 1000, minIncrement: 100 })).toBe(1000);
    expect(minNextBid({ currentPrice: 1500, startPrice: 1000, minIncrement: 100 })).toBe(1600);
  });
  it("enforces the deposit floor and rounds up to 1,000", () => {
    expect(requiredDeposit(1_000_000, 0, 0.05, 25_000)).toBe(50_000);
    expect(requiredDeposit(100_000, 0, 0.05, 25_000)).toBe(25_000);
    expect(requiredDeposit(1_000_000, 200_000, 0.05, 25_000)).toBe(200_000);
    expect(requiredDeposit(1_234_567, 0, 0.05, 0)).toBe(62_000);
  });
  it("extends only inside the anti-snipe window", () => {
    const end = new Date("2026-01-01T12:00:00Z");
    expect(extendedEnd(end, new Date("2026-01-01T11:50:00Z"), 120, 120)).toEqual(end);
    expect(extendedEnd(end, new Date("2026-01-01T11:59:30Z"), 120, 120)).toEqual(new Date("2026-01-01T12:01:30Z"));
  });
  it("rounds commission", () => {
    expect(commissionFor(1_234_567, 0.03)).toBe(37_037);
  });
});

describe("auction flow", () => {
  it("requires verification and enough balance to join", async () => {
    const seller = await user("بائع");
    const a = await auction(seller.id);
    const unverified = await user("غير موثق", 1_000_000, false);
    await expect(joinAuction(unverified.id, a.id)).rejects.toThrow("توثيق");
    const poor = await user("رصيد قليل", 10_000);
    await expect(joinAuction(poor.id, a.id)).rejects.toThrow("رصيد");
    await expect(joinAuction(seller.id, a.id)).rejects.toThrow("مزادك");
  });

  it("holds the deposit once, even if joining twice", async () => {
    const seller = await user("بائع");
    const a = await auction(seller.id);
    const b = await user("مزايد");
    await joinAuction(b.id, a.id);
    await joinAuction(b.id, a.id);
    expect(await balance(b.id)).toBe(900_000);
    const deps = await db.select().from(auctionDeposits).where(eq(auctionDeposits.userId, b.id));
    expect(deps).toHaveLength(1);
  });

  it("validates bids", async () => {
    const seller = await user("بائع");
    const a = await auction(seller.id);
    const b1 = await user("أول");
    const b2 = await user("ثاني");
    await expect(placeBid(b1.id, a.id, 1_000_000)).rejects.toThrow("التأمين");
    await joinAuction(b1.id, a.id);
    await joinAuction(b2.id, a.id);
    await expect(placeBid(b1.id, a.id, 999_000)).rejects.toThrow("أقل مزايدة");
    await placeBid(b1.id, a.id, 1_000_000);
    await expect(placeBid(b1.id, a.id, 1_100_000)).rejects.toThrow("أعلى مزايدة");
    await expect(placeBid(b2.id, a.id, 1_020_000)).rejects.toThrow("أقل مزايدة");
    await placeBid(b2.id, a.id, 1_050_000);
    const after = await getAuction(a.id);
    expect(after.currentPrice).toBe(1_050_000);
    expect(after.bidCount).toBe(2);
  });

  it("rejects bids before start and after end", async () => {
    const seller = await user("بائع");
    const future = await auction(seller.id, { startsAt: new Date(Date.now() + H), endsAt: new Date(Date.now() + 2 * H), status: "scheduled" });
    const b = await user("مزايد");
    await joinAuction(b.id, future.id); // joining early is allowed
    await expect(placeBid(b.id, future.id, 1_000_000)).rejects.toThrow("لم يبدأ");
    const past = await auction(seller.id, { endsAt: new Date(Date.now() - 1000) });
    await expect(joinAuction(b.id, past.id)).rejects.toThrow();
  });

  it("extends the end time for last-minute bids", async () => {
    const seller = await user("بائع");
    const a = await auction(seller.id, { endsAt: new Date(Date.now() + 30_000) });
    const b = await user("مزايد");
    await joinAuction(b.id, a.id);
    const r = await placeBid(b.id, a.id, 1_000_000);
    expect(r.extended).toBe(true);
    expect(r.endsAt.getTime()).toBeGreaterThan(Date.now() + 110_000);
  });

  it("only one of two simultaneous equal bids succeeds", async () => {
    const seller = await user("بائع");
    const a = await auction(seller.id);
    const b1 = await user("أول");
    const b2 = await user("ثاني");
    await joinAuction(b1.id, a.id);
    await joinAuction(b2.id, a.id);
    const results = await Promise.allSettled([placeBid(b1.id, a.id, 1_000_000), placeBid(b2.id, a.id, 1_000_000)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getAuction(a.id)).bidCount).toBe(1);
  });

  it("settles: winner keeps deposit held, losers refunded, seller charged commission", async () => {
    const seller = await user("بائع", 0);
    const a = await auction(seller.id);
    const b1 = await user("أول");
    const b2 = await user("ثاني");
    await joinAuction(b1.id, a.id);
    await joinAuction(b2.id, a.id);
    await placeBid(b1.id, a.id, 1_000_000);
    await placeBid(b2.id, a.id, 1_200_000);
    await db.update(auctions).set({ endsAt: new Date(Date.now() - 1000) }).where(eq(auctions.id, a.id));
    expect(await settleAuction(a.id)).toBe("ended");
    expect(await settleAuction(a.id)).toBe("ended"); // idempotent
    const done = await getAuction(a.id);
    expect(done.winnerId).toBe(b2.id);
    expect(done.winningBid).toBe(1_200_000);
    expect(done.commissionAmount).toBe(36_000);
    expect(await balance(seller.id)).toBe(-36_000);
    expect(await balance(b1.id)).toBe(1_000_000); // refunded
    expect(await balance(b2.id)).toBe(900_000); // still held

    await completeAuction(seller.id, a.id);
    expect(await balance(b2.id)).toBe(1_000_000);
    expect((await getAuction(a.id)).status).toBe("completed");
  });

  it("forfeit compensates the seller and refunds commission", async () => {
    const seller = await user("بائع", 0);
    const a = await auction(seller.id);
    const b = await user("فائز");
    await joinAuction(b.id, a.id);
    await placeBid(b.id, a.id, 2_000_000);
    await db.update(auctions).set({ endsAt: new Date(Date.now() - 1000) }).where(eq(auctions.id, a.id));
    await settleAuction(a.id);
    expect(await balance(seller.id)).toBe(-60_000);
    await forfeitWinner(a.id);
    expect(await balance(seller.id)).toBe(50_000); // commission refunded + 50% of 100k deposit
    expect(await balance(b.id)).toBe(900_000); // deposit lost
    expect((await getAuction(a.id)).status).toBe("cancelled");
  });

  it("ends unsold when the reserve is not met and refunds everyone", async () => {
    const seller = await user("بائع", 0);
    const a = await auction(seller.id, { reservePrice: 5_000_000 });
    const b = await user("مزايد");
    await joinAuction(b.id, a.id);
    await placeBid(b.id, a.id, 1_000_000);
    await db.update(auctions).set({ endsAt: new Date(Date.now() - 1000) }).where(eq(auctions.id, a.id));
    expect(await settleAuction(a.id)).toBe("unsold");
    expect(await balance(b.id)).toBe(1_000_000);
    expect(await balance(seller.id)).toBe(0);
  });

  it("keeps the ledger consistent with balances", async () => {
    const seller = await user("بائع", 0);
    const a = await auction(seller.id);
    const b = await user("مزايد", 0);
    await db.transaction(async (tx) => {
      const { moveFunds } = await import("@/lib/wallet");
      await moveFunds(tx, { userId: b.id, amount: 500_000, type: "topup" });
    });
    await joinAuction(b.id, a.id);
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, b.id));
    const sum = txs.reduce((s, t) => s + t.amount, 0);
    expect(sum).toBe(await balance(b.id));
  });
});
