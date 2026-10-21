import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAuctionAction } from "@/app/actions/auctions";
import { getSettings } from "@/lib/settings";
import { getActiveSubscription } from "@/lib/plans";
import { ANIMAL_CATEGORIES, AUCTION_DURATIONS, GOVERNORATES } from "@/lib/constants";
import { iqd } from "@/lib/format";
import { ActionForm, Field, ImagePicker, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "مزاد جديد" };

export default async function NewAuctionPage() {
  const user = await requireUser("/auctions/new");
  const s = await getSettings();
  const sub = await getActiveSubscription(user.id);
  const canAuction = user.role === "trader" || user.role === "admin";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="افتح مزاداً جديداً" subtitle="مناسب للحيوانات النادرة وذات القيمة العالية: خيول أصيلة، صقور، فحول، سلالات مميزة." />
      <div className="mb-6 space-y-3">
        {!canAuction && (
          <Notice tone="red">فتح المزادات متاح لحسابات «تاجر / مربي» فقط. تواصل مع الدعم لتغيير نوع حسابك.</Notice>
        )}
        {s.requireVerificationForAuctions && user.verificationStatus !== "verified" && (
          <Notice tone="earth">
            يجب توثيق حسابك قبل فتح مزاد. <Link href="/dashboard/profile#verify" className="font-semibold underline">قدّم طلب التوثيق</Link>
          </Notice>
        )}
        <Notice tone="blue">
          عمولة المنصة {(s.auctionCommissionRate * 100).toFixed(1)}% من السعر النهائي، تُخصم من محفظتك عند انتهاء المزاد بنجاح فقط.
          {sub ? ` باقتك الحالية: ${sub.plan.name}.` : ` الحساب المجاني يسمح بـ ${s.freeActiveAuctions} مزاد نشط.`}
        </Notice>
      </div>
      <ActionForm action={createAuctionAction} className="card space-y-6 p-6">
        <Field label="عنوان المزاد">
          <input name="title" className="input" required minLength={5} maxLength={160} placeholder="مثال: فحل عربي أصيل بعمر 4 سنوات" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="نوع الحيوان">
            <select name="category" className="input" required defaultValue="">
              <option value="" disabled>اختر</option>
              {ANIMAL_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </Field>
          <Field label="السلالة">
            <input name="breed" className="input" maxLength={80} />
          </Field>
        </div>
        <Field label="الوصف" hint="النسب، الشهادات، الحالة الصحية، الإنجازات، وأي معلومات تزيد الثقة.">
          <textarea name="description" className="input min-h-32" required minLength={10} maxLength={5000} />
        </Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="العدد"><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></Field>
          <Field label="العمر (أشهر)"><input name="ageMonths" type="number" min={0} className="input" /></Field>
          <Field label="الجنس">
            <select name="gender" className="input" defaultValue="unknown">
              <option value="unknown">غير محدد</option><option value="male">ذكر</option><option value="female">أنثى</option><option value="mixed">مختلط</option>
            </select>
          </Field>
          <Field label="الوزن (كغم)"><input name="weightKg" type="number" min={0} className="input" /></Field>
        </div>
        <Field label="المحافظة">
          <select name="city" className="input" required defaultValue={user.city}>
            {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </Field>

        <div className="rounded-2xl bg-earth-50 p-4">
          <h2 className="mb-4 font-semibold">التسعير والتأمين</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="سعر البداية (د.ع)">
              <input name="startPrice" type="number" min={10000} step={1000} required dir="ltr" className="input text-end" />
            </Field>
            <Field label="الحد الأدنى للزيادة (د.ع)" hint="اتركه فارغاً ليُحسب تلقائياً (≈1% من سعر البداية)">
              <input name="minIncrement" type="number" min={1000} step={1000} dir="ltr" className="input text-end" />
            </Field>
            <Field label="السعر الأدنى المخفي (اختياري)" hint="لن يُباع الحيوان إذا لم تصل المزايدات لهذا السعر">
              <input name="reservePrice" type="number" min={0} step={1000} dir="ltr" className="input text-end" />
            </Field>
            <Field
              label="مبلغ التأمين على المزايد (د.ع)"
              hint={`الحد الأدنى ${Math.round(s.minDepositRate * 100)}% من سعر البداية أو ${iqd(s.minDepositAmount)}، أيهما أكبر`}
            >
              <input name="depositAmount" type="number" min={0} step={1000} dir="ltr" className="input text-end" />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-50 p-4">
          <h2 className="mb-4 font-semibold">التوقيت</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="startMode" value="now" defaultChecked className="accent-brand-600" /> ابدأ فوراً</label>
              <label className="flex items-center gap-2"><input type="radio" name="startMode" value="scheduled" className="accent-brand-600" /> جدولة لوقت لاحق</label>
              <input type="datetime-local" name="startsAt" className="input" aria-label="وقت البدء (بتوقيت بغداد)" />
              <span className="block text-xs text-ink/50">بتوقيت بغداد</span>
            </fieldset>
            <Field label="مدة المزاد">
              <select name="durationHours" className="input" defaultValue="24">
                {AUCTION_DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <ImagePicker />
        <div className="flex justify-end">
          <SubmitButton className="btn-earth" pendingText="جارٍ إنشاء المزاد…">إطلاق المزاد</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
