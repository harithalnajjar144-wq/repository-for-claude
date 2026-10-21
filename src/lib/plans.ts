import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auctions, listings, plans, subscriptions, users } from "@/db/schema";
import { UserError } from "./errors";
import { getSettings } from "./settings";
import { moveFunds } from "./wallet";

export async function getActiveSubscription(userId: number) {
  const rows = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, userId), gt(subscriptions.endsAt, new Date())))
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function assertCanCreateListing(userId: number) {
  const s = await getSettings();
  const sub = await getActiveSubscription(userId);
  const limit = sub ? sub.plan.maxActiveListings : s.freeActiveListings;
  if (limit === null) return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.userId, userId), eq(listings.status, "active")));
  if (n >= limit)
    throw new UserError(
      sub
        ? `وصلت للحد الأقصى من الإعلانات النشطة في باقتك (${limit}). قم بترقية الباقة.`
        : `الحساب المجاني يسمح بـ ${limit} إعلانات نشطة. اشترك في باقة للمزيد.`,
    );
}

export async function assertCanCreateAuction(userId: number) {
  const s = await getSettings();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (s.requireVerificationForAuctions && u.verificationStatus !== "verified")
    throw new UserError("يجب توثيق حسابك قبل فتح مزاد.");
  if (u.walletBalance < 0)
    throw new UserError("عليك مستحقات عمولة غير مسددة. يرجى شحن المحفظة أولاً.");
  const sub = await getActiveSubscription(userId);
  const limit = sub ? sub.plan.maxActiveAuctions : s.freeActiveAuctions;
  if (limit === null) return;
  const [{ n }] = await db
    .select({ n: count() })
    .from(auctions)
    .where(and(eq(auctions.sellerId, userId), inArray(auctions.status, ["scheduled", "live"])));
  if (n >= limit)
    throw new UserError(
      sub
        ? `وصلت للحد الأقصى من المزادات النشطة في باقتك (${limit}).`
        : `الحساب المجاني يسمح بـ ${limit} مزاد نشط. اشترك في باقة التاجر للمزيد.`,
    );
}

/** Buy or extend a monthly plan, paid from the wallet. */
export async function subscribe(userId: number, planId: number, months = 1) {
  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(plans).where(eq(plans.id, planId));
    if (!plan || !plan.isActive) throw new UserError("الباقة غير متاحة.");
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (plan.role !== u.role && u.role !== "admin") throw new UserError("هذه الباقة غير مخصصة لنوع حسابك.");
    const price = plan.priceMonthly * months;
    const now = new Date();
    const [current] = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), gt(subscriptions.endsAt, now)))
      .orderBy(desc(subscriptions.endsAt))
      .limit(1);
    const start = current && current.planId === planId ? current.endsAt : now;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    if (price > 0)
      await moveFunds(tx, {
        userId,
        amount: -price,
        type: "subscription",
        reference: `plan:${plan.slug}`,
        note: `اشتراك ${plan.name} لمدة ${months} شهر`,
      });
    await tx.insert(subscriptions).values({ userId, planId, startsAt: start, endsAt: end, pricePaid: price });
    return end;
  });
}
