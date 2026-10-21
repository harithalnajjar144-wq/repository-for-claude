import Link from "next/link";
import { listAuctions } from "@/lib/queries";
import { settleDueAuctions } from "@/lib/auctions";
import { ANIMAL_CATEGORIES, GOVERNORATES } from "@/lib/constants";
import { AuctionCard } from "@/components/cards";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "المزادات" };

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; city?: string }>;
}) {
  const f = await searchParams;
  await settleDueAuctions();
  const tab = f.tab === "ended" ? "ended" : "active";
  const items = await listAuctions({ status: tab, category: f.category, city: f.city, limit: 48 });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="المزادات"
        subtitle="مزادات محمية بنظام التأمين المالي للحيوانات النادرة وذات القيمة العالية."
        actions={<Link href="/auctions/new" className="btn-earth">+ افتح مزاداً</Link>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-earth-100">
          <Link href="/auctions" className={`rounded-lg px-4 py-1.5 text-sm ${tab === "active" ? "bg-brand-600 font-semibold text-white" : ""}`}>المباشرة والقادمة</Link>
          <Link href="/auctions?tab=ended" className={`rounded-lg px-4 py-1.5 text-sm ${tab === "ended" ? "bg-brand-600 font-semibold text-white" : ""}`}>المنتهية</Link>
        </div>
        <form className="flex flex-wrap gap-2">
          {tab === "ended" && <input type="hidden" name="tab" value="ended" />}
          <select name="category" defaultValue={f.category ?? ""} className="input w-auto">
            <option value="">كل الأنواع</option>
            {ANIMAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
          <select name="city" defaultValue={f.city ?? ""} className="input w-auto">
            <option value="">كل المحافظات</option>
            {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <button className="btn-outline">تصفية</button>
        </form>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="🔨" title={tab === "active" ? "لا توجد مزادات نشطة حالياً" : "لا توجد مزادات منتهية"}>
          لديك حيوان نادر أو ذو قيمة عالية؟ <Link href="/auctions/new" className="font-semibold text-brand-700">افتح مزاداً الآن</Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => <AuctionCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
