import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { iqd } from "@/lib/format";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./Logo";

const NAV = [
  { href: "/listings", label: "السوق" },
  { href: "/auctions", label: "المزادات" },
  { href: "/vets", label: "الأطباء البيطريون" },
  { href: "/shops", label: "محلات التجهيز" },
];

export async function Header() {
  const user = await getCurrentUser();
  let unread = 0;
  if (user) {
    const [r] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
    unread = r.n;
  }
  return (
    <header className="sticky top-0 z-40 border-b border-earth-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink/75 hover:bg-earth-50 hover:text-brand-700">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/listings/new" className="btn-primary hidden sm:inline-flex">
                + أضف إعلان
              </Link>
              <Link href="/dashboard/notifications" className="relative rounded-xl p-2 hover:bg-earth-50" aria-label="الإشعارات">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink/70" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-earth-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="hidden text-sm font-medium md:block">{user.name.split(" ")[0]}</span>
                </summary>
                <div className="card absolute end-0 mt-2 w-60 overflow-hidden p-1 text-sm">
                  <div className="border-b border-earth-50 px-3 py-2">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-xs text-ink/50">المحفظة: {iqd(user.walletBalance)}</div>
                  </div>
                  <MenuLink href="/dashboard">لوحة التحكم</MenuLink>
                  <MenuLink href="/dashboard/listings">إعلاناتي</MenuLink>
                  <MenuLink href="/dashboard/auctions">مزاداتي ومزايداتي</MenuLink>
                  <MenuLink href="/dashboard/wallet">المحفظة</MenuLink>
                  <MenuLink href="/dashboard/profile">الملف الشخصي والتوثيق</MenuLink>
                  {user.role === "admin" && <MenuLink href="/admin">لوحة الإدارة</MenuLink>}
                  <form action={logoutAction}>
                    <button className="w-full rounded-lg px-3 py-2 text-start text-red-600 hover:bg-red-50">تسجيل الخروج</button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                دخول
              </Link>
              <Link href="/register" className="btn-primary">
                حساب جديد
              </Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-xl p-2 hover:bg-earth-50" aria-label="القائمة">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="card absolute end-0 mt-2 w-56 p-1 text-sm">
              {NAV.map((n) => (
                <MenuLink key={n.href} href={n.href}>
                  {n.label}
                </MenuLink>
              ))}
              {user && <MenuLink href="/listings/new">+ أضف إعلان</MenuLink>}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 hover:bg-earth-50">
      {children}
    </Link>
  );
}
