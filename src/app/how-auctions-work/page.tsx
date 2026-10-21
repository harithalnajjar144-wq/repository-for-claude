import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { iqd } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "كيف يعمل المزاد" };

export default async function HowAuctionsWork() {
  const s = await getSettings();
  const steps = [
    ["🛡️", "التأمين المالي", `قبل المشاركة يحجز كل مزايد مبلغ تأمين من محفظته (لا يقل عن ${Math.round(s.minDepositRate * 100)}% من سعر البداية أو ${iqd(s.minDepositAmount)}). هذا يضمن جدية المزايدين ويمنع المزايدات الوهمية.`],
    ["⏱️", "إطلاق المزاد", "يحدد التاجر سعر البداية، الحد الأدنى للزيادة، مبلغ التأمين، ومدة المزاد. ويمكنه وضع سعر أدنى مخفي لا يُباع الحيوان دونه."],
    ["🔨", "التنافس الحي", `يقدم المزايدون الموثقون عروضهم بشكل مباشر وشفاف. أي مزايدة في آخر ${Math.round(s.antiSnipeSeconds / 60)} دقيقة تمدد المزاد ${Math.round(s.antiSnipeExtendSeconds / 60)} دقيقة لمنع القنص في اللحظة الأخيرة.`],
    ["🏆", "الحسم والعمولة", `أعلى عرض عند انتهاء الوقت يفوز. يُعاد التأمين لباقي المزايدين فوراً، وتُستقطع عمولة المنصة (${(s.auctionCommissionRate * 100).toFixed(1)}%) من البائع تلقائياً.`],
    ["🤝", "التسليم", `يتواصل الفائز مع البائع، يعاين الحيوان ويدفع ويستلم. بعد تأكيد البائع يُعاد تأمين الفائز. إذا انسحب الفائز يُصادر تأمينه ويُعوَّض البائع بـ ${Math.round(s.forfeitSellerShare * 100)}% منه وتُعاد له العمولة.`],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title="ديناميكية المزاد الاحترافي" subtitle="مزادات حلالي مصممة للحيوانات النادرة وذات القيمة العالية." />
      <ol className="space-y-4">
        {steps.map(([i, t, d], idx) => (
          <li key={t} className="card flex gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-earth-50 text-2xl">{i}</div>
            <div>
              <div className="font-bold">{idx + 1}. {t}</div>
              <p className="mt-1 leading-8 text-ink/70">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex gap-3">
        <Link href="/auctions" className="btn-primary">تصفح المزادات</Link>
        <Link href="/auctions/new" className="btn-outline">افتح مزاداً</Link>
      </div>
    </div>
  );
}
