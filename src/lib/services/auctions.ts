import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auctionDeposits, auctions, users } from "@/db/schema";
import type { SessionUser } from "../auth";
import { defaultIncrement, requiredDeposit } from "../auctions";
import { getAuctionState } from "../auctionState";
import { UserError } from "../errors";
import { assertCanCreateAuction } from "../plans";
import { getSettings } from "../settings";
import { auctionInput, parse } from "../validation";

/** "2026-11-01T18:30" is Baghdad time (web form); anything with a zone/Z is used as is (API). */
export function parseStart(value: string) {
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(value);
  return new Date(hasZone ? value : `${value}${value.length === 16 ? ":00" : ""}+03:00`);
}

export async function createAuction(user: SessionUser, input: unknown, images: string[]) {
  if (user.role === "user" || user.role === "vet" || user.role === "shop")
    throw new UserError("فتح المزادات متاح لحسابات التجار والمربين فقط.");
  const d = parse(auctionInput, input);
  await assertCanCreateAuction(user.id);
  const s = await getSettings();

  let startsAt = new Date();
  if (d.startMode === "scheduled") {
    if (!d.startsAt) throw new UserError("حدد وقت بدء المزاد.");
    startsAt = parseStart(d.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new UserError("وقت البدء غير صحيح.");
    if (startsAt.getTime() < Date.now() - 60_000) throw new UserError("وقت البدء يجب أن يكون في المستقبل.");
    if (startsAt.getTime() > Date.now() + 30 * 86400_000) throw new UserError("لا يمكن جدولة مزاد بعد أكثر من 30 يوماً.");
  }
  const endsAt = new Date(startsAt.getTime() + d.durationHours * 3600_000);
  const minIncrement = d.minIncrement && d.minIncrement >= 1000 ? d.minIncrement : defaultIncrement(d.startPrice);
  if (d.reservePrice && d.reservePrice < d.startPrice) throw new UserError("السعر الأدنى المخفي يجب أن يكون أعلى من سعر البداية.");
  const deposit = requiredDeposit(d.startPrice, d.depositAmount ?? 0, s.minDepositRate, s.minDepositAmount);
  if (!images.length) throw new UserError("أضف صورة واحدة على الأقل.");
  if (images.length > 8) throw new UserError("الحد الأقصى 8 صور.");

  const [row] = await db
    .insert(auctions)
    .values({
      sellerId: user.id,
      title: d.title,
      description: d.description,
      category: d.category,
      breed: d.breed || null,
      ageMonths: d.ageMonths ?? null,
      gender: d.gender,
      weightKg: d.weightKg ?? null,
      quantity: d.quantity,
      city: d.city,
      images,
      startPrice: d.startPrice,
      minIncrement,
      reservePrice: d.reservePrice || null,
      depositAmount: deposit,
      commissionRate: String(s.auctionCommissionRate),
      startsAt,
      endsAt,
      status: d.startMode === "now" ? "live" : "scheduled",
    })
    .returning();
  return row;
}

/** Full auction page data: details, live state, seller, and (for seller/winner) the other party's contact. */
export async function getAuctionDetail(id: number, viewer: SessionUser | null) {
  const state = await getAuctionState(id, viewer?.id);
  if (!state) return null;
  const [a] = await db.select().from(auctions).where(eq(auctions.id, id));
  const [seller] = await db.select().from(users).where(eq(users.id, a.sellerId));
  const isSeller = viewer?.id === a.sellerId || viewer?.role === "admin";
  const isWinner = !!viewer && viewer.id === a.winnerId;
  let winner = null;
  if (a.winnerId && isSeller) {
    const [w] = await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, a.winnerId));
    winner = w ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reservePrice, ...publicAuction } = a; // the reserve stays hidden from bidders
  return {
    auction: isSeller ? a : publicAuction,
    state,
    seller: {
      id: seller.id,
      name: seller.name,
      city: seller.city,
      verificationStatus: seller.verificationStatus,
      createdAt: seller.createdAt,
      phone: isWinner ? seller.phone : null,
      whatsapp: isWinner ? (seller.whatsapp ?? seller.phone) : null,
    },
    winner,
  };
}

export async function myAuctions(userId: number) {
  const [selling, bidding] = await Promise.all([
    db.select().from(auctions).where(eq(auctions.sellerId, userId)).orderBy(desc(auctions.createdAt)),
    db
      .select({ a: auctions, deposit: { amount: auctionDeposits.amount, status: auctionDeposits.status } })
      .from(auctionDeposits)
      .innerJoin(auctions, eq(auctions.id, auctionDeposits.auctionId))
      .where(eq(auctionDeposits.userId, userId))
      .orderBy(desc(auctionDeposits.createdAt)),
  ]);
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bidding: bidding.map(({ a: { reservePrice, ...a }, deposit }) => ({ ...a, deposit, won: a.winnerId === userId })),
    selling,
  };
}
