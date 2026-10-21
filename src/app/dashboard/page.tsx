import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auctionDeposits, auctions, bookings, listings, notifications, orders, providers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/plans";
import { dateOnly, iqd, num, timeAgo } from "@/lib/format";
import { Notice, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "لوحة التحكم" };

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const [[{ activeListings }], [{ activeAuctions }], [{ heldDeposits }], recent, sub, myProviders] = await Promise.all([
    db.select({ activeListings: count() }).from(listings).where(and(eq(listings.userId, user.id), eq(listings.status, "active"))),
    db.select({ activeAuctions: count() }).from(auctions).where(and(eq(auctions.sellerId, user.id), inArray(auctions.status, ["scheduled", "live"]))),
    db.select({ heldDeposits: count() }).from(auctionDeposits).where(and(eq(auctionDeposits.userId, user.id), eq(auctionDeposits.status, "held"))),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(6),
    getActiveSubscription(user.id),
    db.select().from(providers).where(eq(providers.userId, user.id)),
  ]);
  let pending = 0;
  const prov = myProviders[0];
  if (prov?.kind === "vet")
    pending = (await db.select({ n: count() }).from(bookings).where(and(eq(bookings.providerId, prov.id), eq(bookings.status, "pending"))))[0].n;
  if (prov?.kind === "shop")
    pending = (await db.select({ n: count() }).from(orders).where(and(eq(orders.providerId, prov.id), eq(orders.status, "pending"))))[0].n;

  return (
    <div className="space-y-6">
      <PageHeader title={`أهلاً ${user.name.split(" ")[0]} 👋`} subtitle="هذه نظرة سريعة على نشاطك في حلالي." />
      {welcome && <Notice tone="green">🎉 تم إنشاء حسابك بنجاح! ابدأ بتوثيق حسابك لرفع ثقة المشترين وفتح ميزة المزادات.</Notice>}
      {user.verificationStatus === "none" && (
        <Notice tone="earth">
          حسابك غير موثق. الحسابات الموثقة تظهر بشارة ✓ وتستطيع المشاركة في المزادات.{" "}
          <Link href="/dashboard/profile#verify" className="font-semibold underline">وثّق حسابك</Link>
        </Notice>
      )}
      {user.verificationStatus === "rejected" && (
        <Notice tone="red">تم رفض طلب التوثيق السابق. <Link href="/dashboard/profile#verify" className="font-semibold underline">قدّم طلباً جديداً</Link></Notice>
      )}
      {user.walletBalance < 0 && (
        <Notice tone="red">عليك مستحقات عمولة بقيمة {iqd(-user.walletBalance)}. <Link href="/dashboard/wallet" className="font-semibold underline">اشحن المحفظة</Link> لتتمكن من فتح مزادات جديدة.</Notice>
      )}
      {pending > 0 && (
        <Notice tone="blue">
          لديك {pending} {prov?.kind === "vet" ? "حجز جديد بانتظار التأكيد" : "طلب جديد بانتظار التأكيد"}.{" "}
          <Link href={`/dashboard/business?tab=${prov?.kind === "vet" ? "bookings" : "orders"}`} className="font-semibold underline">عرض</Link>
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="إعلانات نشطة" value={num(activeListings)} />
        <Stat label="مزادات نشطة" value={num(activeAuctions)} />
        <Stat label="تأمينات محجوزة" value={num(heldDeposits)} />
        <Stat label="الباقة" value={sub ? sub.plan.name : "مجانية"} hint={sub ? `حتى ${dateOnly(sub.sub.endsAt)}` : <Link href="/dashboard/subscription" className="text-brand-700">ترقية</Link>} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/listings/new" className="card p-5 transition hover:shadow-lg">
          <div className="text-2xl">📋</div>
          <div className="mt-2 font-semibold">أضف إعلان بيع أو طلب</div>
          <div className="text-sm text-ink/55">انشر خلال دقيقة</div>
        </Link>
        {(user.role === "trader" || user.role === "admin") && (
          <Link href="/auctions/new" className="card p-5 transition hover:shadow-lg">
            <div className="text-2xl">🔨</div>
            <div className="mt-2 font-semibold">افتح مزاداً</div>
            <div className="text-sm text-ink/55">للحيوانات النادرة والقيمة</div>
          </Link>
        )}
        <Link href="/dashboard/wallet" className="card p-5 transition hover:shadow-lg">
          <div className="text-2xl">💳</div>
          <div className="mt-2 font-semibold">اشحن المحفظة</div>
          <div className="text-sm text-ink/55">للتأمينات والاشتراكات</div>
        </Link>
      </div>
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">آخر الإشعارات</h2>
          <Link href="/dashboard/notifications" className="text-sm text-brand-700">عرض الكل</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink/55">لا توجد إشعارات بعد.</p>
        ) : (
          <ul className="divide-y divide-earth-50">
            {recent.map((n) => (
              <li key={n.id} className="py-2.5">
                <Link href={n.link ?? "#"} className="block">
                  <div className={`text-sm ${n.isRead ? "" : "font-semibold"}`}>{n.title}</div>
                  {n.body && <div className="text-xs text-ink/60">{n.body}</div>}
                  <div className="text-xs text-ink/40">{timeAgo(n.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
