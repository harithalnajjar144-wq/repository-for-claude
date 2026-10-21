import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "@/app/actions/auth";
import { GOVERNORATES } from "@/lib/constants";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { RoleFields } from "./RoleFields";

export const metadata = { title: "إنشاء حساب" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="card p-7">
        <h1 className="text-2xl font-bold">انضم إلى حلالي</h1>
        <p className="mt-1 text-sm text-ink/60">التسجيل مجاني. اختر نوع حسابك وابدأ خلال دقيقة.</p>
        <ActionForm action={registerAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <RoleFields initial={role} />
          <Field label="الاسم الكامل">
            <input name="name" className="input" required minLength={3} maxLength={120} autoComplete="name" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الهاتف">
              <input name="phone" type="tel" dir="ltr" className="input text-end" placeholder="07XX XXX XXXX" required autoComplete="tel" />
            </Field>
            <Field label="المحافظة">
              <select name="city" className="input" required defaultValue="">
                <option value="" disabled>اختر</option>
                {GOVERNORATES.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="كلمة المرور" hint="8 أحرف على الأقل">
            <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
          </Field>
          <p className="text-xs text-ink/55">
            بالتسجيل أنت توافق على <Link href="/terms" className="underline">شروط الاستخدام</Link>.
          </p>
          <SubmitButton className="btn-primary w-full" pendingText="جارٍ إنشاء الحساب…">إنشاء الحساب</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-ink/60">
          لديك حساب؟ <Link href="/login" className="font-semibold text-brand-700">سجّل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
