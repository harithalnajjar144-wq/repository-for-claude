import Link from "next/link";
import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { ads, auctions, listings, providers, users } from "@/db/schema";
import { latestListings, listAuctions, listProviders } from "@/lib/queries";
import { settleDueAuctions } from "@/lib/auctions";
import { ANIMAL_CATEGORIES, GOVERNORATES } from "@/lib/constants";
import { num } from "@/lib/format";
import { AuctionCard, ListingCard, ProviderCard } from "@/components/cards";

async function activeAd() {
  const [ad] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.isActive, true), eq(ads.placement, "home_top"), or(isNull(ads.endsAt), gt(ads.endsAt, new Date()))))
    .orderBy(sql`random()`)
    .limit(1);
  if (ad) await db.update(ads).set({ impressions: sql`${ads.impressions} + 1` }).where(eq(ads.id, ad.id));
  return ad;
}

export default async function Home() {
  await settleDueAuctions();
  const [latest, live, vets, shops, ad, [stats]] = await Promise.all([
    latestListings(8),
    listAuctions({ status: "active", limit: 4 }),
    listProviders("vet", { limit: 3 }),
    listProviders("shop", { limit: 3 }),
    activeAd(),
    db
      .select({
        listings: sql<number>`(select count(*)::int from ${listings} where ${listings.status} = 'active')`,
        auctions: sql<number>`(select count(*)::int from ${auctions} where ${auctions.status} in ('scheduled','live'))`,
        verified: sql<number>`(select count(*)::int from ${users} where ${users.verificationStatus} = 'verified')`,
        providers: sql<number>`(select count(*)::int from ${providers} where ${providers.isActive})`,
      })
      .from(sql`(select 1) as x`),
  ]);
  const counts = await db
    .select({ category: listings.category, n: count() })
    .from(listings)
    .where(eq(listings.status, "active"))
    .groupBy(listings.category);
  const countOf = (k: string) => counts.find((c) => c.category === k)?.n ?? 0;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 80% 20%, #4c9f6f 0, transparent 45%), radial-gradient(circle at 10% 90%, #a9733a 0, transparent 40%)" }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="badge bg-white/10 text-earth-200 ring-1 ring-white/20">🇮🇶 أول منصة متخصصة بسوق المواشي في العراق</span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
              سوق المواشي…
              <br />
              <span className="text-earth-300">منظم، رقمي، وموثوق.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">
              بيع واشترِ مباشرة بدون وسطاء، شارك في مزادات محمية بالتأمين، واحجز عند طبيب بيطري أو اطلب أعلافك من محلات التجهيز، كل ذلك في مكان واحد.
            </p>
            <form action="/listings" className="mt-8 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
              <select name="category" className="input border-0 text-ink focus:ring-0 sm:w-44" defaultValue="">
                <option value="">كل الحيوانات</option>
                {ANIMAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
              </select>
              <select name="city" className="input border-0 text-ink focus:ring-0 sm:w-40" defaultValue="">
                <option value="">كل المحافظات</option>
                {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              <input name="q" className="input flex-1 border-0 text-ink focus:ring-0" placeholder="ابحث عن سلالة… عواسي، كرادي، شامي" />
              <button className="btn-primary px-6">بحث</button>
            </form>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [num(stats.listings), "إعلان نشط", "🐑"],
              [num(stats.auctions), "مزاد مباشر وقادم", "🔨"],
              [num(stats.verified), "حساب موثق", "✓"],
              [num(stats.providers), "طبيب ومحل", "🩺"],
            ].map(([v, l, i]) => (
              <div key={l} className="rounded-2xl bg-white/8 p-5 ring-1 ring-white/15 backdrop-blur">
                <div className="text-2xl">{i}</div>
                <div className="mt-2 text-3xl font-bold">{v}</div>
                <div className="text-sm text-white/65">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        {/* Categories */}
        <section>
          <h2 className="mb-5 text-2xl font-bold">تصفح حسب النوع</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
            {ANIMAL_CATEGORIES.map((c) => (
              <Link key={c.key} href={`/listings?category=${c.key}`} className="card flex flex-col items-center gap-1 p-4 text-center transition hover:-translate-y-0.5 hover:border-brand-300">
                <span className="text-3xl">{c.icon}</span>
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="text-xs text-ink/45">{num(countOf(c.key))}</span>
              </Link>
            ))}
          </div>
        </section>

        {ad && (
          <a href={`/api/ads/${ad.id}/click`} className="card relative block overflow-hidden bg-gradient-to-l from-earth-500 to-earth-400 p-6 text-white">
            {ad.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            )}
            <div className="relative">
              <span className="badge bg-white/20 text-white">إعلان</span>
              <div className="mt-2 text-xl font-bold">{ad.title}</div>
              {ad.subtitle && <div className="text-white/85">{ad.subtitle}</div>}
            </div>
          </a>
        )}

        {/* Live auctions */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">🔨 المزادات المباشرة</h2>
              <p className="text-sm text-ink/55">للحيوانات النادرة وذات القيمة العالية، محمية بنظام التأمين.</p>
            </div>
            <Link href="/auctions" className="text-sm font-semibold text-brand-700">كل المزادات ←</Link>
          </div>
          {live.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{live.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
          ) : (
            <div className="card p-8 text-center text-ink/60">لا توجد مزادات حالياً. <Link href="/auctions/new" className="font-semibold text-brand-700">افتح أول مزاد</Link></div>
          )}
        </section>

        {/* Latest listings */}
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-bold">أحدث الإعلانات</h2>
            <Link href="/listings" className="text-sm font-semibold text-brand-700">السوق كاملاً ←</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{latest.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        </section>

        {/* Four pillars */}
        <section className="card overflow-hidden">
          <div className="grid md:grid-cols-4">
            {[
              ["🛒", "المستخدم", "تصفح، شراء مباشر، ودخول المزايدات بأمان.", "/register?role=user"],
              ["🐑", "التاجر والمربي", "انشر إعلانات بيع الحيوانات والدواجن وافتح المزادات.", "/register?role=trader"],
              ["🩺", "الطبيب البيطري", "اعرض خدماتك واستقبل الحجوزات والاستشارات.", "/register?role=vet"],
              ["🏪", "محلات الرعاية", "اعرض الأعلاف والأدوية والمستلزمات للبيع أونلاين.", "/register?role=shop"],
            ].map(([i, t, d, h]) => (
              <Link key={t} href={h} className="border-earth-50 p-6 transition hover:bg-earth-50 md:border-e last:border-e-0">
                <div className="text-3xl">{i}</div>
                <div className="mt-3 font-bold">{t}</div>
                <p className="mt-1 text-sm leading-7 text-ink/60">{d}</p>
                <span className="mt-2 inline-block text-sm font-semibold text-brand-700">انضم ←</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Vets & shops */}
        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold">🩺 أطباء بيطريون</h2>
              <Link href="/vets" className="text-sm font-semibold text-brand-700">الكل ←</Link>
            </div>
            <div className="space-y-3">{vets.map((r) => <ProviderCard key={r.p.id} p={r.p} verified={r.verificationStatus} />)}</div>
          </div>
          <div>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold">🏪 محلات الأعلاف والمستلزمات</h2>
              <Link href="/shops" className="text-sm font-semibold text-brand-700">الكل ←</Link>
            </div>
            <div className="space-y-3">{shops.map((r) => <ProviderCard key={r.p.id} p={r.p} verified={r.verificationStatus} />)}</div>
          </div>
        </section>

        {/* Trust */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["✓", "حسابات موثقة", "نتحقق من هوية البائعين والأطباء والمحلات قبل منحهم شارة التوثيق."],
            ["🛡️", "مزادات بالتأمين", "كل مزايد يحجز تأميناً ماليّاً قبل المشاركة، فتنتهي المزايدات الوهمية."],
            ["💬", "تواصل مباشر", "بدون وسطاء: اتصل بالبائع أو راسله على واتساب مباشرة."],
          ].map(([i, t, d]) => (
            <div key={t} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700">{i}</div>
              <div className="mt-3 font-bold">{t}</div>
              <p className="mt-1 text-sm leading-7 text-ink/60">{d}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
