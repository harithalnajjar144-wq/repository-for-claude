import Link from "next/link";
import { searchListings, type ListingFilters as F } from "@/lib/queries";
import { ANIMAL_CATEGORIES, categoryLabel, cityLabel } from "@/lib/constants";
import { num } from "@/lib/format";
import { ListingCard } from "@/components/cards";
import { ListingFilters } from "@/components/ListingFilters";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";

export async function generateMetadata({ searchParams }: { searchParams: Promise<F> }) {
  const f = await searchParams;
  const parts = [f.category && categoryLabel(f.category), f.city && `في ${cityLabel(f.city)}`].filter(Boolean);
  return { title: parts.length ? `${parts.join(" ")} للبيع` : "سوق المواشي" };
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<F> }) {
  const f = await searchParams;
  const res = await searchListings(f);
  const qs = (patch: Partial<F>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v) p.set(k, String(v));
    return `/listings?${p}`;
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title={f.category ? `${categoryLabel(f.category)}${f.city ? ` في ${cityLabel(f.city)}` : ""}` : "سوق المواشي"}
        subtitle={`${num(res.total)} إعلان`}
        actions={<Link href="/listings/new" className="btn-primary">+ أضف إعلان</Link>}
      />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link href={qs({ category: undefined, page: undefined })} className={`badge shrink-0 px-3 py-1.5 text-sm ${!f.category ? "bg-brand-600 text-white" : "bg-white ring-1 ring-earth-100"}`}>الكل</Link>
        {ANIMAL_CATEGORIES.map((c) => (
          <Link key={c.key} href={qs({ category: c.key, page: undefined })} className={`badge shrink-0 px-3 py-1.5 text-sm ${f.category === c.key ? "bg-brand-600 text-white" : "bg-white ring-1 ring-earth-100"}`}>
            {c.icon} {c.label}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside><ListingFilters f={f} /></aside>
        <section>
          {res.items.length === 0 ? (
            <EmptyState title="لا توجد إعلانات مطابقة">جرّب توسيع البحث أو <Link href="/listings/new" className="font-semibold text-brand-700">أضف طلب شراء</Link> ليصلك البائعون.</EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {res.items.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
          )}
          <Pagination page={res.page} totalPages={res.totalPages} makeHref={(p) => qs({ page: String(p) })} />
        </section>
      </div>
    </div>
  );
}
