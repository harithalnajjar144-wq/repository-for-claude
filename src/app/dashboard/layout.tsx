import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { iqd } from "@/lib/format";
import { VerifiedBadge } from "@/components/ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const links: [string, string][] = [
    ["/dashboard", "🏠 نظرة عامة"],
    ["/dashboard/listings", "📋 إعلاناتي"],
    ["/dashboard/auctions", "🔨 المزادات"],
    ["/dashboard/favorites", "♡ المفضلة"],
    ["/dashboard/bookings", "📅 حجوزاتي البيطرية"],
    ["/dashboard/orders", "🛒 طلباتي"],
    ["/dashboard/wallet", "💳 المحفظة"],
    ["/dashboard/subscription", "⭐ الباقة"],
    ["/dashboard/notifications", "🔔 الإشعارات"],
    ["/dashboard/profile", "👤 الملف والتوثيق"],
  ];
  if (user.role === "vet") links.splice(1, 0, ["/dashboard/business", "🩺 إدارة العيادة"]);
  if (user.role === "shop") links.splice(1, 0, ["/dashboard/business", "🏪 إدارة المحل"]);
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="font-semibold">{user.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink/55">
            {ROLE_LABELS[user.role]} <VerifiedBadge status={user.verificationStatus} />
          </div>
          <div className="mt-3 rounded-xl bg-brand-50 p-3">
            <div className="text-xs text-ink/55">رصيد المحفظة</div>
            <div className={`text-lg font-bold ${user.walletBalance < 0 ? "text-red-600" : "text-brand-700"}`}>{iqd(user.walletBalance)}</div>
          </div>
        </div>
        <nav className="card flex gap-1 overflow-x-auto p-2 lg:flex-col">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm hover:bg-earth-50">
              {label}
            </Link>
          ))}
          {user.role === "admin" && (
            <Link href="/admin" className="shrink-0 rounded-lg bg-ink px-3 py-2 text-sm text-white">⚙️ لوحة الإدارة</Link>
          )}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
