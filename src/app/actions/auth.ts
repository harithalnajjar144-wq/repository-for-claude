"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { otpRequired, requestOtp, verifyOtp } from "@/lib/otp";
import { authenticate, registerUser, resetPassword } from "@/lib/services/account";
import { formObject } from "@/lib/validation";

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
};

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const input: Record<string, unknown> = formObject(fd);
    if (otpRequired()) {
      const code = String(fd.get("otpCode") ?? "");
      if (!code) throw new UserError("أدخل رمز التحقق الذي وصلك برسالة.");
      input.otpToken = (await verifyOtp(String(fd.get("phone") ?? ""), "register", code)).otpToken;
    }
    const u = await registerUser(input);
    await createSession(u.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect(safeNext(fd.get("next")) === "/dashboard" ? "/dashboard?welcome=1" : safeNext(fd.get("next")));
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const u = await authenticate(String(fd.get("phone") ?? ""), String(fd.get("password") ?? ""));
    await createSession(u.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** Send an SMS code (sign-up or password reset). */
export async function sendOtpAction(phone: string, purpose: "register" | "reset"): Promise<ActionState> {
  try {
    await requestOtp(phone, purpose === "reset" ? "reset" : "register");
    return { ok: true, message: "تم إرسال رمز التحقق برسالة نصية." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const phone = String(fd.get("phone") ?? "");
    const { otpToken } = await verifyOtp(phone, "reset", String(fd.get("otpCode") ?? ""));
    const u = await resetPassword(phone, otpToken, String(fd.get("password") ?? ""));
    await createSession(u.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect("/dashboard");
}
