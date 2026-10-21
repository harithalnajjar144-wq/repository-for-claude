import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export default async function AdminSettings() {
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="إعدادات المنصة" />
      <ActionForm action={saveSettingsAction} className="card space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">المزادات</h2>
          <Field label="نسبة العمولة" hint="كسر عشري: 0.03 = 3%"><input name="auctionCommissionRate" type="number" step="0.001" min={0} max={0.5} dir="ltr" className="input" defaultValue={s.auctionCommissionRate} /></Field>
          <Field label="أقل تأمين (نسبة من سعر البداية)" hint="0.05 = 5%"><input name="minDepositRate" type="number" step="0.01" min={0} max={1} dir="ltr" className="input" defaultValue={s.minDepositRate} /></Field>
          <Field label="أقل تأمين (د.ع)"><input name="minDepositAmount" type="number" step={1000} min={0} dir="ltr" className="input" defaultValue={s.minDepositAmount} /></Field>
          <Field label="نافذة منع القنص (ثانية)"><input name="antiSnipeSeconds" type="number" min={0} dir="ltr" className="input" defaultValue={s.antiSnipeSeconds} /></Field>
          <Field label="مدة التمديد (ثانية)"><input name="antiSnipeExtendSeconds" type="number" min={0} dir="ltr" className="input" defaultValue={s.antiSnipeExtendSeconds} /></Field>
          <Field label="حصة البائع من التأمين المصادر" hint="0.5 = 50%"><input name="forfeitSellerShare" type="number" step="0.05" min={0} max={1} dir="ltr" className="input" defaultValue={s.forfeitSellerShare} /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" name="requireVerificationForAuctions" defaultChecked={s.requireVerificationForAuctions} className="h-4 w-4 accent-brand-600" /> التوثيق إلزامي للمزايدة وفتح المزادات</label>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <h2 className="font-semibold md:col-span-3">الحساب المجاني والإعلانات</h2>
          <Field label="الإعلانات النشطة المجانية"><input name="freeActiveListings" type="number" min={0} dir="ltr" className="input" defaultValue={s.freeActiveListings} /></Field>
          <Field label="المزادات النشطة المجانية"><input name="freeActiveAuctions" type="number" min={0} dir="ltr" className="input" defaultValue={s.freeActiveAuctions} /></Field>
          <Field label="سعر تمييز إعلان 7 أيام"><input name="featuredListingPrice" type="number" step={1000} min={0} dir="ltr" className="input" defaultValue={s.featuredListingPrice} /></Field>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">الدفع والتواصل</h2>
          <Field label="رقم زين كاش لاستقبال الشحن"><input name="zaincashNumber" dir="ltr" className="input" defaultValue={s.zaincashNumber} /></Field>
          <Field label="هاتف الدعم"><input name="supportPhone" dir="ltr" className="input" defaultValue={s.supportPhone} /></Field>
        </section>
        <SubmitButton>حفظ الإعدادات</SubmitButton>
      </ActionForm>
    </div>
  );
}
