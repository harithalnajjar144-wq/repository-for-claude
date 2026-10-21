import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { verificationRequests } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { GOVERNORATES, VERIFICATION_LABELS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { changePasswordAction, requestVerificationAction, updateProfileAction } from "@/app/actions/account";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "الملف الشخصي" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [lastReq] = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.userId, user.id))
    .orderBy(desc(verificationRequests.createdAt))
    .limit(1);
  const tone = user.verificationStatus === "verified" ? "green" : user.verificationStatus === "pending" ? "amber" : user.verificationStatus === "rejected" ? "red" : "gray";
  return (
    <div className="space-y-6">
      <PageHeader title="الملف الشخصي والتوثيق" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionForm action={updateProfileAction} className="card space-y-4 p-5">
          <h2 className="font-semibold">البيانات الشخصية</h2>
          <Field label="الاسم" hint={user.verificationStatus === "verified" ? "لا يمكن تغيير الاسم بعد التوثيق" : undefined}>
            <input name="name" className="input" defaultValue={user.name} readOnly={user.verificationStatus === "verified"} />
          </Field>
          <Field label="رقم الهاتف (للدخول)"><input className="input" value={user.phone} dir="ltr" disabled /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المحافظة">
              <select name="city" className="input" defaultValue={user.city}>
                {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="رقم الواتساب"><input name="whatsapp" className="input" dir="ltr" defaultValue={user.whatsapp ?? ""} /></Field>
          </div>
          <Field label="البريد الإلكتروني (اختياري)"><input name="email" type="email" dir="ltr" className="input" defaultValue={user.email ?? ""} /></Field>
          <Field label="نبذة"><textarea name="bio" className="input" maxLength={1000} defaultValue={user.bio ?? ""} placeholder="مثال: مربي أغنام عواسي منذ 15 سنة في الرمادي" /></Field>
          <SubmitButton>حفظ</SubmitButton>
        </ActionForm>

        <div id="verify" className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">توثيق الحساب</h2>
            <Badge tone={tone}>{VERIFICATION_LABELS[user.verificationStatus]}</Badge>
          </div>
          {user.verificationStatus === "verified" ? (
            <Notice tone="green">✓ حسابك موثق. تظهر شارة التوثيق بجانب اسمك ويمكنك المشاركة في المزادات.</Notice>
          ) : user.verificationStatus === "pending" ? (
            <Notice tone="earth">طلبك قيد المراجعة منذ {dateTime(lastReq?.createdAt)}. سنبلغك فور اتخاذ القرار.</Notice>
          ) : (
            <ActionForm action={requestVerificationAction} className="space-y-4">
              {user.verificationStatus === "rejected" && lastReq?.adminNote && <Notice tone="red">سبب الرفض السابق: {lastReq.adminNote}</Notice>}
              <p className="text-sm leading-7 text-ink/70">
                التوثيق يرفع ثقة المشترين بك ويفتح ميزة المزادات. صور المستمسكات لا تظهر لأي مستخدم وتراجعها الإدارة فقط.
              </p>
              <Field label="الاسم الرباعي كما في المستمسك"><input name="fullName" className="input" required minLength={6} /></Field>
              <Field label="نوع المستمسك">
                <select name="documentType" className="input" required>
                  <option value="national_id">البطاقة الوطنية الموحدة</option>
                  <option value="passport">جواز السفر</option>
                  <option value="residence">بطاقة السكن</option>
                </select>
              </Field>
              <Field label="صور المستمسك (الوجه والظهر)"><input name="documentImages" type="file" accept="image/*" multiple required className="input" /></Field>
              {(user.role === "vet" || user.role === "shop") && (
                <Field label={user.role === "vet" ? "إجازة ممارسة المهنة البيطرية" : "إجازة المحل / الهوية التجارية"}>
                  <input name="licenseImage" type="file" accept="image/*" required className="input" />
                </Field>
              )}
              <Field label="ملاحظات (اختياري)"><textarea name="note" className="input" maxLength={1000} /></Field>
              <SubmitButton pendingText="جارٍ الرفع…">إرسال طلب التوثيق</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      <ActionForm action={changePasswordAction} className="card max-w-md space-y-4 p-5" resetOnSuccess>
        <h2 className="font-semibold">تغيير كلمة المرور</h2>
        <Field label="كلمة المرور الحالية"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
        <Field label="كلمة المرور الجديدة"><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
        <SubmitButton className="btn-outline">تغيير</SubmitButton>
      </ActionForm>
    </div>
  );
}
