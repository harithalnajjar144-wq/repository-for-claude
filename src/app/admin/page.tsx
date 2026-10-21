import { and, count, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { auctions, bookings, listings, orders, users, walletTransactions } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/constants";
import { iqd, num } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";

async function revenue(since?: Date) {
  const where = [inArray(walletTransactions.type, ["commission", "subscription", "featured"])];
  if (since) where.push(gte(walletTransactions.createdAt, since));
  const rows = await db
    .select({ type: walletTransactions.type, total: sum(walletTransactions.amount) })
    .from(walletTransactions)
    .where(and(...where))
    .groupBy(walletTransactions.type);
  const by = Object.fromEntries(rows.map((r) => [r.type, -Number(r.total ?? 0)]));
  return { commission: by.commission ?? 0, subscription: by.subscription ?? 0, featured: by.featured ?? 0 };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);

export default async function AdminHome() {
  const month = daysAgo(30);
  const [roles, [activeL], [liveA], [completedA], [b], [o], rev30, revAll, [newUsers]] = await Promise.all([
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
    db.select({ n: count() }).from(listings).where(eq(listings.status, "active")),
    db.select({ n: count() }).from(auctions).where(inArray(auctions.status, ["scheduled", "live"])),
    db.select({ n: count(), gmv: sum(auctions.winningBid) }).from(auctions).where(inArray(auctions.status, ["ended", "completed"])),
    db.select({ n: count() }).from(bookings).where(gte(bookings.createdAt, month)),
    db.select({ n: count(), total: sum(orders.total) }).from(orders).where(and(gte(orders.createdAt, month), sql`${orders.status} <> 'cancelled'`)),
    revenue(month),
    revenue(),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, month)),
  ]);
  const totalUsers = roles.reduce((s, r) => s + r.n, 0);
  const sum30 = rev30.commission + rev30.subscription + rev30.featured;
  const sumAll = revAll.commission + revAll.subscription + revAll.featured;
  return (
    <div className="space-y-6">
      <PageHeader title="الإحصائيات" subtitle="نظرة عامة على أداء المنصة" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="المستخدمون" value={num(totalUsers)} hint={`+${num(newUsers.n)} خلال 30 يوماً`} />
        <Stat label="إعلانات نشطة" value={num(activeL.n)} />
        <Stat label="مزادات نشطة" value={num(liveA.n)} />
        <Stat label="مزادات ناجحة" value={num(completedA.n)} hint={`قيمة المبيعات ${iqd(Number(completedA.gmv ?? 0))}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">الإيرادات</h2>
          <table className="table-base">
            <thead><tr><th>المصدر</th><th>آخر 30 يوماً</th><th>الإجمالي</th></tr></thead>
            <tbody>
              <tr><td>عمولات المزادات</td><td>{iqd(rev30.commission)}</td><td>{iqd(revAll.commission)}</td></tr>
              <tr><td>الاشتراكات</td><td>{iqd(rev30.subscription)}</td><td>{iqd(revAll.subscription)}</td></tr>
              <tr><td>تمييز الإعلانات</td><td>{iqd(rev30.featured)}</td><td>{iqd(revAll.featured)}</td></tr>
              <tr className="font-bold"><td>المجموع</td><td>{iqd(sum30)}</td><td>{iqd(sumAll)}</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink/50">لا تشمل حصة المنصة من التأمينات المصادرة ولا عائدات المساحات الإعلانية (تُحصّل خارج المنصة).</p>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">المستخدمون حسب النوع</h2>
          <ul className="space-y-2 text-sm">
            {roles.map((r) => (
              <li key={r.role} className="flex justify-between"><span>{ROLE_LABELS[r.role]}</span><b>{num(r.n)}</b></li>
            ))}
          </ul>
          <h2 className="mt-5 mb-2 font-semibold">آخر 30 يوماً</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>حجوزات بيطرية</span><b>{num(b.n)}</b></li>
            <li className="flex justify-between"><span>طلبات من المحلات</span><b>{num(o.n)} ({iqd(Number(o.total ?? 0))})</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
