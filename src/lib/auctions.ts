import { and, desc, eq, inArray, lte, sql, gt } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auctionDeposits, auctions, bids, users, type Auction } from "@/db/schema";
import { UserError } from "./errors";
import { moveFunds } from "./wallet";
import { notify } from "./notify";
import { getSettings } from "./settings";
import { iqd } from "./format";

// ---------- Pure rules (unit tested) ----------

/** The lowest amount the next bid may be. */
export function minNextBid(a: Pick<Auction, "currentPrice" | "startPrice" | "minIncrement">) {
  return a.currentPrice === null || a.currentPrice === undefined
    ? a.startPrice
    : a.currentPrice + a.minIncrement;
}

/** Deposit required to join: max(seller's choice, rate × start price, floor), rounded up to 1,000 IQD. */
export function requiredDeposit(startPrice: number, sellerDeposit: number, rate: number, floor: number) {
  const raw = Math.max(sellerDeposit || 0, Math.ceil(startPrice * rate), floor);
  return Math.ceil(raw / 1000) * 1000;
}

/** Default minimum increment: ~1% of the start price, rounded to 1,000 IQD, at least 5,000. */
export function defaultIncrement(startPrice: number) {
  return Math.max(5000, Math.round(startPrice / 100 / 1000) * 1000);
}

/** New end time after a bid at `now` (anti-sniping). */
export function extendedEnd(endsAt: Date, now: Date, windowSec: number, extendSec: number): Date {
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining > windowSec * 1000) return endsAt;
  return new Date(Math.max(endsAt.getTime(), now.getTime() + extendSec * 1000));
}

export function commissionFor(winningBid: number, rate: number) {
  return Math.round(winningBid * rate);
}

/** Status as it should be right now, before any lazy settlement is written. */
export function liveStatus(a: Pick<Auction, "status" | "startsAt" | "endsAt">, now = new Date()) {
  if (a.status === "scheduled" || a.status === "live") {
    if (now >= a.endsAt) return "closing" as const;
    if (now >= a.startsAt) return "live" as const;
    return "scheduled" as const;
  }
  return a.status;
}

// ---------- Database operations ----------

async function lockAuction(tx: Tx, id: number): Promise<Auction> {
  await tx.execute(sql`select id from auctions where id = ${id} for update`);
  const [a] = await tx.select().from(auctions).where(eq(auctions.id, id));
  if (!a) throw new UserError("المزاد غير موجود.");
  return a;
}

/** Pay the deposit to take part in an auction. */
export async function joinAuction(userId: number, auctionId: number) {
  const s = await getSettings();
  return db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    const st = liveStatus(a);
    if (st !== "live" && st !== "scheduled") throw new UserError("لا يمكن الانضمام لهذا المزاد الآن.");
    if (a.sellerId === userId) throw new UserError("لا يمكنك المزايدة على مزادك.");
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (s.requireVerificationForAuctions && u.verificationStatus !== "verified")
      throw new UserError("يجب توثيق حسابك قبل الدخول في المزادات.");
    const existing = await tx
      .select()
      .from(auctionDeposits)
      .where(and(eq(auctionDeposits.auctionId, auctionId), eq(auctionDeposits.userId, userId)));
    if (existing[0]?.status === "held") return existing[0];
    if (existing[0]) throw new UserError("تمت معالجة تأمينك في هذا المزاد مسبقاً.");
    await moveFunds(tx, {
      userId,
      amount: -a.depositAmount,
      type: "deposit_hold",
      reference: `auction:${auctionId}`,
      note: `تأمين مزاد: ${a.title}`,
    });
    const [dep] = await tx
      .insert(auctionDeposits)
      .values({ auctionId, userId, amount: a.depositAmount })
      .returning();
    return dep;
  });
}

/** Place a bid. Requires a held deposit. */
export async function placeBid(userId: number, auctionId: number, amount: number, now = new Date()) {
  if (!Number.isInteger(amount) || amount <= 0) throw new UserError("قيمة المزايدة غير صحيحة.");
  const s = await getSettings();
  const result = await db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    const st = liveStatus(a, now);
    if (st === "scheduled") throw new UserError("المزاد لم يبدأ بعد.");
    if (st !== "live") throw new UserError("انتهى المزاد.");
    if (a.sellerId === userId) throw new UserError("لا يمكنك المزايدة على مزادك.");
    const [dep] = await tx
      .select()
      .from(auctionDeposits)
      .where(
        and(
          eq(auctionDeposits.auctionId, auctionId),
          eq(auctionDeposits.userId, userId),
          eq(auctionDeposits.status, "held"),
        ),
      );
    if (!dep) throw new UserError("يجب دفع مبلغ التأمين قبل المزايدة.");
    const min = minNextBid(a);
    if (amount < min) throw new UserError(`أقل مزايدة مسموحة الآن هي ${iqd(min)}.`);
    const [top] = await tx
      .select()
      .from(bids)
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.amount), bids.createdAt)
      .limit(1);
    if (top?.bidderId === userId) throw new UserError("أنت صاحب أعلى مزايدة حالياً.");
    await tx.insert(bids).values({ auctionId, bidderId: userId, amount, createdAt: now });
    const newEnd = extendedEnd(a.endsAt, now, s.antiSnipeSeconds, s.antiSnipeExtendSeconds);
    await tx
      .update(auctions)
      .set({ currentPrice: amount, bidCount: a.bidCount + 1, status: "live", endsAt: newEnd })
      .where(eq(auctions.id, auctionId));
    if (top && top.bidderId !== userId) {
      await notify(
        top.bidderId,
        "تمت المزايدة عليك",
        `مزايدة جديدة بقيمة ${iqd(amount)} على "${a.title}"`,
        `/auctions/${auctionId}`,
        tx,
      );
    }
    return { amount, endsAt: newEnd, extended: newEnd.getTime() !== a.endsAt.getTime() };
  });
  return result;
}

async function releaseDeposits(tx: Tx, auctionId: number, title: string, exceptUserId?: number) {
  const held = await tx
    .select()
    .from(auctionDeposits)
    .where(and(eq(auctionDeposits.auctionId, auctionId), eq(auctionDeposits.status, "held")));
  for (const d of held) {
    if (d.userId === exceptUserId) continue;
    await moveFunds(tx, {
      userId: d.userId,
      amount: d.amount,
      type: "deposit_release",
      reference: `auction:${auctionId}`,
      note: `إرجاع تأمين مزاد: ${title}`,
    });
    await tx
      .update(auctionDeposits)
      .set({ status: "released", resolvedAt: new Date() })
      .where(eq(auctionDeposits.id, d.id));
  }
}

/** Close an auction whose end time has passed. Safe to call repeatedly. */
export async function settleAuction(auctionId: number, now = new Date()) {
  return db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    if (liveStatus(a, now) !== "closing") return a.status;
    const [top] = await tx
      .select()
      .from(bids)
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.amount), bids.createdAt)
      .limit(1);
    const reserveMet = top && (a.reservePrice === null || top.amount >= a.reservePrice);
    if (!top || !reserveMet) {
      await tx
        .update(auctions)
        .set({ status: "unsold", settledAt: now })
        .where(eq(auctions.id, auctionId));
      await releaseDeposits(tx, auctionId, a.title);
      await notify(
        a.sellerId,
        "انتهى مزادك",
        top ? "لم تصل المزايدات إلى السعر الأدنى المحدد." : "انتهى المزاد بدون مزايدات.",
        `/auctions/${auctionId}`,
        tx,
      );
      return "unsold" as const;
    }
    const rate = Number(a.commissionRate);
    const commission = commissionFor(top.amount, rate);
    await tx
      .update(auctions)
      .set({
        status: "ended",
        winnerId: top.bidderId,
        winningBid: top.amount,
        commissionAmount: commission,
        settledAt: now,
      })
      .where(eq(auctions.id, auctionId));
    if (commission > 0) {
      // Charged to the seller; may leave a negative balance that must be paid before new auctions.
      await moveFunds(tx, {
        userId: a.sellerId,
        amount: -commission,
        type: "commission",
        reference: `auction:${auctionId}`,
        note: `عمولة المنصة ${(rate * 100).toFixed(1)}% على مزاد: ${a.title}`,
        allowNegative: true,
      });
    }
    // Everyone except the winner gets their deposit back now.
    await releaseDeposits(tx, auctionId, a.title, top.bidderId);
    const [seller] = await tx.select().from(users).where(eq(users.id, a.sellerId));
    const [winner] = await tx.select().from(users).where(eq(users.id, top.bidderId));
    await notify(
      top.bidderId,
      "🎉 فزت بالمزاد!",
      `فزت بمزاد "${a.title}" بمبلغ ${iqd(top.amount)}. تواصل مع البائع ${seller.name} على ${seller.phone} لإتمام الاستلام.`,
      `/auctions/${auctionId}`,
      tx,
    );
    await notify(
      a.sellerId,
      "انتهى مزادك بنجاح",
      `الفائز: ${winner.name} (${winner.phone}) بمبلغ ${iqd(top.amount)}. أكّد إتمام التسليم من صفحة المزاد.`,
      `/auctions/${auctionId}`,
      tx,
    );
    return "ended" as const;
  });
}

/** Move scheduled→live and settle anything past its end time. Called lazily and from cron. */
export async function settleDueAuctions(now = new Date()) {
  await db
    .update(auctions)
    .set({ status: "live" })
    .where(and(eq(auctions.status, "scheduled"), lte(auctions.startsAt, now), gt(auctions.endsAt, now)));
  const due = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(inArray(auctions.status, ["scheduled", "live"]), lte(auctions.endsAt, now)));
  for (const { id } of due) await settleAuction(id, now);
  return due.length;
}

/** Seller confirms the animal was handed over and paid → winner's deposit is returned. */
export async function completeAuction(sellerId: number, auctionId: number, asAdmin = false) {
  return db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    if (!asAdmin && a.sellerId !== sellerId) throw new UserError("غير مصرح.");
    if (a.status !== "ended") throw new UserError("لا يمكن إتمام هذا المزاد.");
    await releaseDeposits(tx, auctionId, a.title);
    await tx
      .update(auctions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(auctions.id, auctionId));
    if (a.winnerId)
      await notify(a.winnerId, "تم إتمام الصفقة", `أُعيد مبلغ التأمين إلى محفظتك.`, `/auctions/${auctionId}`, tx);
  });
}

/**
 * Winner backed out: forfeit their deposit. Part goes to the seller as compensation,
 * the commission charged to the seller is refunded, and the auction is cancelled.
 */
export async function forfeitWinner(auctionId: number, adminNote?: string) {
  const s = await getSettings();
  return db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    if (a.status !== "ended" || !a.winnerId) throw new UserError("لا يوجد فائز لمصادرة تأمينه.");
    const [dep] = await tx
      .select()
      .from(auctionDeposits)
      .where(
        and(
          eq(auctionDeposits.auctionId, auctionId),
          eq(auctionDeposits.userId, a.winnerId),
          eq(auctionDeposits.status, "held"),
        ),
      );
    if (dep) {
      await tx
        .update(auctionDeposits)
        .set({ status: "forfeited", resolvedAt: new Date() })
        .where(eq(auctionDeposits.id, dep.id));
      // Record the forfeit on the winner's ledger (amount already left their balance when held).
      const [w] = await tx.select().from(users).where(eq(users.id, a.winnerId));
      await tx.execute(
        sql`insert into wallet_transactions (user_id, type, amount, balance_after, reference, note)
            values (${a.winnerId}, 'deposit_forfeit', 0, ${w.walletBalance}, ${`auction:${auctionId}`},
                    ${`مصادرة تأمين ${iqd(dep.amount)} لعدم إتمام الصفقة`})`,
      );
      const share = Math.round(dep.amount * s.forfeitSellerShare);
      if (share > 0)
        await moveFunds(tx, {
          userId: a.sellerId,
          amount: share,
          type: "deposit_compensation",
          reference: `auction:${auctionId}`,
          note: `تعويض عن انسحاب الفائز في مزاد: ${a.title}`,
        });
    }
    if (a.commissionAmount && a.commissionAmount > 0)
      await moveFunds(tx, {
        userId: a.sellerId,
        amount: a.commissionAmount,
        type: "adjustment",
        reference: `auction:${auctionId}`,
        note: "إرجاع العمولة لعدم إتمام الصفقة",
      });
    await tx.update(auctions).set({ status: "cancelled" }).where(eq(auctions.id, auctionId));
    await notify(a.winnerId, "تمت مصادرة التأمين", adminNote ?? "لعدم إتمام صفقة المزاد.", `/auctions/${auctionId}`, tx);
    await notify(a.sellerId, "تم تعويضك", "تمت مصادرة تأمين الفائز وإضافة التعويض إلى محفظتك.", `/auctions/${auctionId}`, tx);
  });
}

/** Cancel an auction. Sellers can only cancel before any bid; admins any time before completion. */
export async function cancelAuction(userId: number, auctionId: number, asAdmin = false) {
  return db.transaction(async (tx) => {
    const a = await lockAuction(tx, auctionId);
    if (!asAdmin && a.sellerId !== userId) throw new UserError("غير مصرح.");
    if (!asAdmin && a.bidCount > 0) throw new UserError("لا يمكن إلغاء مزاد بعد بدء المزايدات.");
    if (["completed", "cancelled", "unsold"].includes(a.status)) throw new UserError("لا يمكن إلغاء هذا المزاد.");
    await releaseDeposits(tx, auctionId, a.title);
    if (a.status === "ended" && a.commissionAmount && a.commissionAmount > 0)
      await moveFunds(tx, {
        userId: a.sellerId,
        amount: a.commissionAmount,
        type: "adjustment",
        reference: `auction:${auctionId}`,
        note: "إرجاع العمولة بسبب إلغاء المزاد",
      });
    await tx.update(auctions).set({ status: "cancelled" }).where(eq(auctions.id, auctionId));
  });
}
