import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auctionDeposits, auctions, bids, users } from "@/db/schema";
import { liveStatus, minNextBid, settleAuction } from "./auctions";

export function maskName(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return second ? `${first} ${second.slice(0, 1)}.` : first;
}

export type AuctionLiveState = Awaited<ReturnType<typeof getAuctionState>>;

/** Public, poll-friendly view of an auction (settles it first if its time is up). */
export async function getAuctionState(id: number, viewerId?: number) {
  let [a] = await db.select().from(auctions).where(eq(auctions.id, id));
  if (!a) return null;
  if (liveStatus(a) === "closing") {
    await settleAuction(id);
    [a] = await db.select().from(auctions).where(eq(auctions.id, id));
  }
  const history = await db
    .select({ id: bids.id, amount: bids.amount, createdAt: bids.createdAt, bidderId: bids.bidderId, name: users.name })
    .from(bids)
    .innerJoin(users, eq(users.id, bids.bidderId))
    .where(eq(bids.auctionId, id))
    .orderBy(desc(bids.amount))
    .limit(30);
  let deposit: string | null = null;
  if (viewerId) {
    const [d] = await db
      .select({ status: auctionDeposits.status })
      .from(auctionDeposits)
      .where(and(eq(auctionDeposits.auctionId, id), eq(auctionDeposits.userId, viewerId)));
    deposit = d?.status ?? null;
  }
  const st = liveStatus(a);
  return {
    id: a.id,
    status: st,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    startPrice: a.startPrice,
    currentPrice: a.currentPrice,
    minNext: minNextBid(a),
    minIncrement: a.minIncrement,
    depositAmount: a.depositAmount,
    bidCount: a.bidCount,
    winningBid: a.winningBid,
    reserveMet: a.reservePrice === null || (a.currentPrice ?? 0) >= a.reservePrice,
    hasReserve: a.reservePrice !== null,
    bids: history.map((b) => ({
      id: b.id,
      amount: b.amount,
      at: b.createdAt.toISOString(),
      name: b.bidderId === viewerId ? "أنت" : maskName(b.name),
      mine: b.bidderId === viewerId,
    })),
    me: viewerId
      ? {
          isSeller: a.sellerId === viewerId,
          deposit,
          isTop: history[0]?.bidderId === viewerId,
          isWinner: a.winnerId === viewerId,
        }
      : null,
    serverTime: new Date().toISOString(),
  };
}
