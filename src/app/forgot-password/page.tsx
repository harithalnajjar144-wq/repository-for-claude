import Link from "next/link";
import { redirect } from "next/navigation";
import { otpRequired } from "@/lib/otp";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PhoneWithOtp } from "@/components/OtpField";

export const metadata = { title: "استعادة كلمة المرور" };

export default function ForgotPasswordPage() {
  if (!otpRequired()) redirect("/login");
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-7">
        <h1 className="text-2xl font-bold">استعادة كلمة المرور</h1>
        <p className="mt-1 text-sm text-ink/60">سنرسل رمز تحقق إلى رقم هاتفك.</p>
        <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
          <PhoneWithOtp purpose="reset" />
          <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
            <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
          </Field>
          <SubmitButton className="btn-primary w-full">تغيير كلمة المرور والدخول</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="text-brand-700">العودة لتسجيل الدخول</Link></p>
      </div>
    </div>
  );
}
