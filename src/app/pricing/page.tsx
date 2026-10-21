import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/constants";
import { iqd } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "الباقات والأسعار" };

export default async function Pricing() {
  const [rows, s] = await Promise.all([db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)), getSettings()]);
  const groups = ["trader", "vet", "shop"].map((r) => ({ role: r, plans: rows.filter((p) => p.role === r) })).filter((g) => g.plans.length);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="الباقات والأسعار" subtitle="التصفح والشراء مجاني دائماً. الباقات المدفوعة للتجار والأطباء والمحلات." />
      <div className="card mb-8 grid gap-4 p-6 md:grid-cols-3">
        <div><div className="font-semibold">الحساب المجاني</div><p className="text-sm text-ink/60">{s.freeActiveListings} إعلانات نشطة و{s.freeActiveAuctions} مزاد نشط للتجار.</p></div>
        <div><div className="font-semibold">عمولة المزاد</div><p className="text-sm text-ink/60">{(s.auctionCommissionRate * 100).toFixed(1)}% من السعر النهائي، على البائع، فقط عند نجاح المزاد.</p></div>
        <div><div className="font-semibold">تمييز الإعلان</div><p className="text-sm text-ink/60">{iqd(s.featuredListingPrice)} لـ 7 أيام في أعلى النتائج.</p></div>
      </div>
      {groups.map((g) => (
        <section key={g.role} className="mb-10">
          <h2 className="mb-4 text-xl font-bold">باقات {ROLE_LABELS[g.role]}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {g.plans.map((p) => (
              <div key={p.id} className="card flex flex-col p-6">
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-2 text-3xl font-bold text-brand-700">{iqd(p.priceMonthly)}<span className="text-sm font-normal text-ink/50"> / شهر</span></div>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  <li>✓ {p.maxActiveListings === null ? "إعلانات غير محدودة" : `${p.maxActiveListings} إعلان نشط`}</li>
                  {p.role === "trader" && <li>✓ {p.maxActiveAuctions === null ? "مزادات غير محدودة" : `${p.maxActiveAuctions} مزاد نشط`}</li>}
                  {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <Link href="/dashboard/subscription" className="btn-primary mt-5">اشترك</Link>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
