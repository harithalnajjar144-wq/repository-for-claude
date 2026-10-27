import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { otpRequired } from "@/lib/otp";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next ?? "/dashboard");
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-7">
        <h1 className="text-2xl font-bold">أهلاً بعودتك 👋</h1>
        <p className="mt-1 text-sm text-ink/60">سجّل الدخول برقم هاتفك.</p>
        <ActionForm action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="رقم الهاتف">
            <input name="phone" type="tel" inputMode="tel" dir="ltr" className="input text-end" placeholder="07XX XXX XXXX" required autoComplete="tel" />
          </Field>
          <Field label="كلمة المرور">
            <input name="password" type="password" className="input" required autoComplete="current-password" />
          </Field>
          <SubmitButton className="btn-primary w-full" pendingText="جارٍ الدخول…">دخول</SubmitButton>
          {otpRequired() && (
            <Link href="/forgot-password" className="block text-center text-sm text-ink/60 hover:text-brand-700">نسيت كلمة المرور؟</Link>
          )}
        </ActionForm>
        <p className="mt-6 text-center text-sm text-ink/60">
          ليس لديك حساب؟{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700">
            أنشئ حساباً مجاناً
          </Link>
        </p>
      </div>
    </div>
  );
}
