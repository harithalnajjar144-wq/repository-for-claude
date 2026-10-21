import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auctions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuctionState } from "@/lib/auctionState";
import { AUCTION_STATUS_LABELS, categoryIcon, categoryLabel, cityLabel, GENDER_LABELS } from "@/lib/constants";
import { ageLabel, dateTime, iqd, num } from "@/lib/format";
import { cancelAuctionAction, completeAuctionAction, joinAuctionAction, placeBidAction } from "@/app/actions/auctions";
import { AuctionLivePanel } from "@/components/AuctionLivePanel";
import { AuctionStatusBadge, Thumb } from "@/components/cards";
import { ContactCard } from "@/components/ContactCard";
import { Gallery } from "@/components/Gallery";
import { ReportForm } from "@/components/ReportForm";
import { SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const [a] = await db.select().from(auctions).where(eq(auctions.id, Number((await params).id) || 0));
  return a ? { title: `مزاد: ${a.title}` } : {};
}

export default async function AuctionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const id = Number((await params).id) || 0;
  const { created } = await searchParams;
  const user = await getCurrentUser();
  const state = await getAuctionState(id, user?.id);
  if (!state) notFound();
  const [a] = await db.select().from(auctions).where(eq(auctions.id, id));
  const [seller] = await db.select().from(users).where(eq(users.id, a.sellerId));
  const winner = a.winnerId ? (await db.select().from(users).where(eq(users.id, a.winnerId)))[0] : null;
  const isSeller = user?.id === a.sellerId;
  const isAdmin = user?.role === "admin";
  const isWinner = !!user && user.id === a.winnerId;

  const facts: [string, string | null][] = [
    ["النوع", `${categoryIcon(a.category)} ${categoryLabel(a.category)}`],
    ["السلالة", a.breed],
    ["العدد", num(a.quantity)],
    ["العمر", ageLabel(a.ageMonths)],
    ["الجنس", a.gender !== "unknown" ? GENDER_LABELS[a.gender] : null],
    ["الوزن", a.weightKg ? `${a.weightKg} كغم` : null],
    ["الموقع", cityLabel(a.city)],
    ["سعر البداية", iqd(a.startPrice)],
    ["الحد الأدنى للزيادة", iqd(a.minIncrement)],
    ["مبلغ التأمين", iqd(a.depositAmount)],
    ["يبدأ", dateTime(a.startsAt)],
    ["ينتهي", dateTime(a.endsAt)],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-ink/55">
        <Link href="/auctions" className="hover:text-brand-700">المزادات</Link> › <span className="text-ink/80">{a.title}</span>
      </nav>
      {created && (
        <div className="mb-4">
          <Notice tone="green">✅ تم إنشاء المزاد. شارك الرابط مع زبائنك لزيادة المزايدين.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:gap-x-8">
        <div className="lg:col-start-1 lg:row-start-1"><Gallery images={a.images} fallback={<Thumb category={a.category} />} /></div>
        <div className="max-lg:order-last lg:col-start-1">
          <div className="card p-6">
            <div className="flex items-center gap-2">
              <AuctionStatusBadge a={a} />
              <span className="text-xs text-ink/50">مزاد رقم #{a.id}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold">{a.title}</h1>
            <dl className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-earth-50/70 p-3">
                  <dt className="text-xs text-ink/50">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <h2 className="mt-6 mb-2 font-semibold">الوصف</h2>
            <p className="whitespace-pre-line leading-8 text-ink/80">{a.description}</p>
          </div>
          <div className="card mt-6 p-6 text-sm leading-7 text-ink/75">
            <h2 className="mb-2 font-semibold text-ink">قواعد المزاد</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>المشاركة للحسابات الموثقة بعد حجز مبلغ التأمين من المحفظة.</li>
              <li>كل مزايدة مُلزِمة ويجب أن تزيد عن السابقة بالحد الأدنى للزيادة على الأقل.</li>
              <li>أعلى مزايدة عند انتهاء الوقت تفوز. يُعاد التأمين لغير الفائزين فوراً.</li>
              <li>يُعاد تأمين الفائز بعد تأكيد البائع للتسليم، ويُصادر إن انسحب الفائز.</li>
              <li>تستقطع المنصة عمولة {(Number(a.commissionRate) * 100).toFixed(1)}% من البائع على السعر النهائي.</li>
            </ul>
            <Link href="/how-auctions-work" className="mt-2 inline-block font-semibold text-brand-700">تفاصيل أكثر ←</Link>
          </div>
        </div>

        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <AuctionLivePanel
            initial={state}
            loggedIn={!!user}
            verified={user?.verificationStatus === "verified"}
            walletBalance={user?.walletBalance ?? 0}
            joinAction={joinAuctionAction}
            bidAction={placeBidAction}
          />

          {(isSeller || isAdmin) && (
            <div className="card space-y-3 p-5 text-sm">
              <h2 className="font-semibold">إدارة المزاد</h2>
              <p>الحالة: {AUCTION_STATUS_LABELS[a.status]}</p>
              {winner && (
                <div className="rounded-xl bg-brand-50 p-3">
                  <div className="font-semibold">الفائز: {winner.name}</div>
                  <a href={`tel:${winner.phone}`} dir="ltr" className="text-brand-700">{winner.phone}</a>
                  <div className="mt-1">السعر النهائي: {iqd(a.winningBid)}</div>
                  <div>عمولة المنصة: {iqd(a.commissionAmount)}</div>
                </div>
              )}
              {a.status === "ended" && (
                <form action={completeAuctionAction}>
                  <input type="hidden" name="auctionId" value={a.id} />
                  <SubmitButton className="btn-primary w-full" confirm="هل استلم الفائز الحيوان ودفع المبلغ؟ سيُعاد له التأمين.">
                    ✓ تأكيد إتمام التسليم
                  </SubmitButton>
                  <p className="mt-2 text-xs text-ink/55">إذا انسحب الفائز، استخدم زر الإبلاغ وسيراجع فريق الإدارة مصادرة التأمين لتعويضك.</p>
                </form>
              )}
              {["scheduled", "live"].includes(a.status) && (a.bidCount === 0 || isAdmin) && (
                <form action={cancelAuctionAction}>
                  <input type="hidden" name="auctionId" value={a.id} />
                  <SubmitButton className="btn-outline w-full text-red-600" confirm="إلغاء المزاد وإرجاع التأمينات؟">إلغاء المزاد</SubmitButton>
                </form>
              )}
            </div>
          )}

          {(isWinner || !isSeller) && (
            isWinner ? (
              <ContactCard seller={seller} loggedIn next={`/auctions/${a.id}`} message={`السلام عليكم، أنا الفائز بمزاد حلالي رقم ${a.id}: ${a.title}`} />
            ) : (
              <div className="card flex items-center gap-3 p-4 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{seller.name.slice(0, 1)}</div>
                <div>
                  <div className="font-semibold">{seller.name} {seller.verificationStatus === "verified" && <span className="text-brand-600">✓ موثق</span>}</div>
                  <Link href={`/u/${seller.id}`} className="text-xs text-brand-700">ملف البائع</Link>
                </div>
              </div>
            )
          )}
          {user && !isSeller && <ReportForm targetType="auction" targetId={a.id} />}
        </aside>
      </div>
    </div>
  );
}
