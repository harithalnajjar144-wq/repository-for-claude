"use client";

import { useState, useTransition } from "react";
import { sendOtpAction } from "@/app/actions/auth";

/** Phone field + "send code" button + code input, for sign-up and password reset. */
export function PhoneWithOtp({ purpose }: { purpose: "register" | "reset" }) {
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">رقم الهاتف</span>
        <div className="flex gap-2">
          <input name="phone" type="tel" dir="ltr" className="input text-end" placeholder="07XX XXX XXXX" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button
            type="button"
            className="btn-outline shrink-0"
            disabled={pending || phone.length < 10}
            onClick={() =>
              start(async () => {
                const r = await sendOtpAction(phone, purpose);
                setMsg(r?.error ? { text: r.error } : { ok: true, text: r?.message ?? "" });
              })
            }
          >
            {pending ? "…" : "إرسال الرمز"}
          </button>
        </div>
      </label>
      {msg && <p className={`text-sm ${msg.ok ? "text-brand-700" : "text-red-600"}`}>{msg.text}</p>}
      <label className="block">
        <span className="label">رمز التحقق</span>
        <input name="otpCode" inputMode="numeric" maxLength={6} dir="ltr" className="input text-center tracking-[0.5em]" placeholder="------" required autoComplete="one-time-code" />
      </label>
    </div>
  );
}
