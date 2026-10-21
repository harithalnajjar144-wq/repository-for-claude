import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, topupRequests, verificationRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "لوحة الإدارة" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [[v], [t], [r]] = await Promise.all([
    db.select({ n: count() }).from(verificationRequests).where(eq(verificationRequests.status, "pending")),
    db.select({ n: count() }).from(topupRequests).where(eq(topupRequests.status, "pending")),
    db.select({ n: count() }).from(reports).where(eq(reports.status, "open")),
  ]);
  const links: [string, string, number?][] = [
    ["/admin", "📊 الإحصائيات"],
    ["/admin/verifications", "🪪 طلبات التوثيق", v.n],
    ["/admin/topups", "💳 طلبات الشحن", t.n],
    ["/admin/reports", "🚩 البلاغات", r.n],
    ["/admin/users", "👥 المستخدمون"],
    ["/admin/listings", "📋 الإعلانات"],
    ["/admin/auctions", "🔨 المزادات"],
    ["/admin/plans", "⭐ الباقات"],
    ["/admin/ads", "📣 المساحات الإعلانية"],
    ["/admin/settings", "⚙️ الإعدادات"],
  ];
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[230px_1fr]">
      <nav className="card flex h-fit gap-1 overflow-x-auto p-2 lg:flex-col">
        <div className="hidden px-3 py-2 text-xs font-semibold text-ink/45 lg:block">لوحة الإدارة</div>
        {links.map(([href, label, n]) => (
          <Link key={href} href={href} className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-earth-50">
            {label}
            {!!n && <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{n}</span>}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
