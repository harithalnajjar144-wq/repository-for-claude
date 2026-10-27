import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { favorites, listings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { categoryIcon, categoryLabel, cityLabel, GENDER_LABELS } from "@/lib/constants";
import { ageLabel, dateTime, iqd, num } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { featureListingAction, setListingStatusAction, toggleFavoriteAction } from "@/app/actions/listings";
import { Gallery } from "@/components/Gallery";
import { ListingCard, Thumb } from "@/components/cards";
import { ContactCard } from "@/components/ContactCard";
import { ReportForm } from "@/components/ReportForm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Notice } from "@/components/ui";

async function load(id: number) {
  const [row] = await db
    .select({ l: listings, seller: users })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(listings.id, id));
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const row = await load(Number((await params).id) || 0);
  if (!row) return {};
  return { title: row.l.title, description: row.l.description.slice(0, 160) };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const id = Number((await params).id) || 0;
  const { created } = await searchParams;
  const row = await load(id);
  const user = await getCurrentUser();
  if (!row) notFound();
  const { l, seller } = row;
  const isOwner = user && (user.id === l.userId || user.role === "admin");
  if ((l.status === "removed" || l.status === "hidden" || seller.isBanned) && !isOwner) notFound();

  if (!isOwner) await db.update(listings).set({ views: sql`${listings.views} + 1` }).where(eq(listings.id, id));

  const [fav, similarRows, s] = await Promise.all([
    user
      ? db.select().from(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.listingId, id)))
      : Promise.resolve([]),
    db
      .select({ l: listings, seller: { name: users.name, verificationStatus: users.verificationStatus } })
      .from(listings)
      .innerJoin(users, eq(users.id, listings.userId))
      .where(and(eq(listings.status, "active"), eq(listings.category, l.category), ne(listings.id, id)))
      .orderBy(sql`(case when ${listings.city} = ${l.city} then 0 else 1 end)`, desc(listings.createdAt))
      .limit(4),
    getSettings(),
  ]);
  const featured = l.featuredUntil && l.featuredUntil > new Date();

  const facts: [string, string | null][] = [
    ["النوع", `${categoryIcon(l.category)} ${categoryLabel(l.category)}`],
    ["السلالة", l.breed],
    ["العدد", l.quantity > 1 ? num(l.quantity) : "1"],
    ["العمر", ageLabel(l.ageMonths)],
    ["الجنس", l.gender !== "unknown" ? GENDER_LABELS[l.gender] : null],
    ["الوزن التقريبي", l.weightKg ? `${l.weightKg} كغم` : null],
    ["الموقع", `${cityLabel(l.city)}${l.area ? ` - ${l.area}` : ""}`],
    ["تاريخ النشر", dateTime(l.createdAt)],
    ["المشاهدات", num(l.views)],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-ink/55">
        <Link href="/listings" className="hover:text-brand-700">السوق</Link> ›{" "}
        <Link href={`/listings?category=${l.category}`} className="hover:text-brand-700">{categoryLabel(l.category)}</Link> ›{" "}
        <span className="text-ink/80">{l.title}</span>
      </nav>

      {created && <div className="mb-4"><Notice tone="green">✅ تم نشر إعلانك بنجاح. يمكنك تمييزه ليظهر أولاً في نتائج البحث.</Notice></div>}
      {l.moderatedAt && l.status !== "active" ? (
        <div className="mb-4"><Notice tone="red">أوقفت الإدارة هذا الإعلان لمخالفته شروط النشر. تواصل مع الدعم للاستفسار.</Notice></div>
      ) : l.status !== "active" ? (
        <div className="mb-4"><Notice tone="earth">{l.status === "sold" ? "تم بيع هذا الإعلان." : "هذا الإعلان غير ظاهر للعامة."}</Notice></div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr] lg:gap-x-8">
        <div className="lg:col-start-1 lg:row-start-1"><Gallery images={l.images} fallback={<Thumb category={l.category} />} /></div>
        <div className="max-lg:order-last lg:col-start-1">
          <div className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              {l.type === "wanted" ? <Badge tone="blue">طلب شراء</Badge> : <Badge tone="green">للبيع</Badge>}
              {featured && <Badge tone="amber">★ إعلان مميز</Badge>}
              {l.negotiable && <Badge tone="earth">قابل للتفاوض</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold">{l.title}</h1>
            <div className="mt-2 text-3xl font-bold text-brand-700">{iqd(l.price)}</div>
            {l.price && l.quantity > 1 && <div className="text-sm text-ink/55">≈ {iqd(Math.round(l.price / l.quantity))} للرأس</div>}

            <dl className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-earth-50/70 p-3">
                  <dt className="text-xs text-ink/50">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-6 mb-2 font-semibold">الوصف</h2>
            <p className="whitespace-pre-line leading-8 text-ink/80">{l.description}</p>
          </div>
        </div>

        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {isOwner ? (
            <div className="card space-y-3 p-5">
              <h2 className="font-semibold">إدارة الإعلان</h2>
              <Link href={`/listings/${l.id}/edit`} className="btn-outline w-full">✏️ تعديل</Link>
              {!(l.moderatedAt && user?.role !== "admin") && (
              <form action={setListingStatusAction} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="id" value={l.id} />
                {l.status === "active" ? (
                  <>
                    <button name="status" value="sold" className="btn-outline">تم البيع</button>
                    <button name="status" value="hidden" className="btn-outline">إخفاء</button>
                  </>
                ) : (
                  <button name="status" value="active" className="btn-outline col-span-2">إعادة النشر</button>
                )}
              </form>
              )}
              {l.status === "active" && (
                <ActionForm action={featureListingAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <SubmitButton className="btn-earth w-full" pendingText="جارٍ التمييز…" confirm={`سيتم خصم ${iqd(s.featuredListingPrice)} من محفظتك. متابعة؟`}>
                    ★ تمييز الإعلان 7 أيام ({iqd(s.featuredListingPrice)})
                  </SubmitButton>
                  {featured && <p className="mt-2 text-xs text-ink/55">مميز حتى {dateTime(l.featuredUntil)}</p>}
                </ActionForm>
              )}
            </div>
          ) : (
            <ContactCard
              seller={seller}
              loggedIn={!!user}
              next={`/listings/${l.id}`}
              message={`السلام عليكم، بخصوص إعلانك على حلالي: ${l.title}`}
            />
          )}
          {user && !isOwner && (
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="id" value={l.id} />
              <button className="btn-outline w-full">{fav.length ? "♥ في المفضلة" : "♡ أضف إلى المفضلة"}</button>
            </form>
          )}
          <div className="card p-5 text-sm leading-7 text-ink/70">
            <h3 className="mb-2 font-semibold text-ink">نصائح للشراء الآمن</h3>
            <ul className="list-inside list-disc space-y-1">
              <li>عاين الحيوان بنفسك قبل الدفع.</li>
              <li>اطلب شهادة التطعيم أو افحصه عند طبيب بيطري.</li>
              <li>فضّل التعامل مع البائعين الموثقين.</li>
              <li>لا تحوّل عربوناً لشخص غير معروف.</li>
            </ul>
            <Link href="/vets" className="mt-3 inline-block font-semibold text-brand-700">ابحث عن طبيب بيطري قريب ←</Link>
          </div>
          {user && !isOwner && <ReportForm targetType="listing" targetId={l.id} />}
        </aside>
      </div>

      {similarRows.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">إعلانات مشابهة</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {similarRows.map((r) => <ListingCard key={r.l.id} l={{ ...r.l, seller: r.seller }} />)}
          </div>
        </section>
      )}
    </div>
  );
}
