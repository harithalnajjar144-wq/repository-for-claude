/**
 * SMS one-time codes for confirming phone numbers (sign-up) and resetting passwords.
 *
 * Provider is chosen with SMS_PROVIDER:
 *   (unset)  codes are not required — sign-up works without SMS (current behaviour)
 *   log      codes are required and printed to the server log (development / testing)
 *   twilio   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (number or Messaging Service SID)
 *   webhook  POSTs {to, message} as JSON to SMS_WEBHOOK_URL (Bearer SMS_WEBHOOK_TOKEN) —
 *            use this to plug in any Iraqi SMS gateway with a few lines of glue.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { phoneOtps, users } from "@/db/schema";
import { UserError } from "./errors";
import { normalizePhone } from "./format";

export type OtpPurpose = "register" | "reset";

const CODE_TTL_MS = 10 * 60_000;
const TOKEN_TTL_MS = 30 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 60_000;
const MAX_PER_HOUR = 5;

export const otpProvider = () => (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
/** Whether sign-up must confirm the phone number by SMS. */
export const otpRequired = () => otpProvider() !== "" && otpProvider() !== "off";

const secret = () => process.env.OTP_SECRET ?? process.env.CRON_SECRET ?? "halali-otp";
const hashCode = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}:${secret()}`).digest("hex");
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

function toE164(phone: string) {
  return "+964" + phone.replace(/^0/, "");
}

async function sendSms(phone: string, message: string) {
  const p = otpProvider();
  if (p === "log") {
    console.log(`[halali] SMS to ${phone}: ${message}`);
    return;
  }
  if (p === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const from = process.env.TWILIO_FROM!;
    const body = new URLSearchParams({ To: toE164(phone), Body: message });
    body.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64") },
      body,
    });
    if (!r.ok) throw new Error(`twilio ${r.status}: ${await r.text()}`);
    return;
  }
  if (p === "webhook") {
    const r = await fetch(process.env.SMS_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to: toE164(phone), phone, message }),
    });
    if (!r.ok) throw new Error(`sms webhook ${r.status}`);
    return;
  }
  throw new Error(`Unknown SMS_PROVIDER "${p}"`);
}

/** Send a 6-digit code to the phone. */
export async function requestOtp(rawPhone: string, purpose: OtpPurpose) {
  if (!otpRequired()) throw new UserError("خدمة رسائل التحقق غير مفعلة حالياً.");
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new UserError("رقم الهاتف غير صحيح. مثال: 07701234567");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (purpose === "register" && existing) throw new UserError("هذا الرقم مسجل مسبقاً. سجّل الدخول بدلاً من ذلك.");
  if (purpose === "reset" && !existing) throw new UserError("لا يوجد حساب بهذا الرقم.");

  const recent = await db
    .select({ createdAt: phoneOtps.createdAt })
    .from(phoneOtps)
    .where(and(eq(phoneOtps.phone, phone), gt(phoneOtps.createdAt, new Date(Date.now() - 3600_000))))
    .orderBy(desc(phoneOtps.createdAt));
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_AFTER_MS)
    throw new UserError("انتظر دقيقة قبل طلب رمز جديد.");
  if (recent.length >= MAX_PER_HOUR) throw new UserError("تجاوزت عدد المحاولات. حاول بعد ساعة.");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(phoneOtps).values({ phone, purpose, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  try {
    await sendSms(phone, `رمز التحقق في حلالي: ${code}\nلا تشاركه مع أي شخص.`);
  } catch (e) {
    console.error("[halali] SMS send failed", e);
    throw new UserError("تعذر إرسال الرسالة. حاول مرة أخرى بعد قليل.");
  }
  return { phone, expiresInSeconds: CODE_TTL_MS / 1000 };
}

/** Check a code. Returns a short-lived verification token to pass to register / password reset. */
export async function verifyOtp(rawPhone: string, purpose: OtpPurpose, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new UserError("رقم الهاتف غير صحيح.");
  const [row] = await db
    .select()
    .from(phoneOtps)
    .where(and(eq(phoneOtps.phone, phone), eq(phoneOtps.purpose, purpose), isNull(phoneOtps.verifiedTokenHash), isNull(phoneOtps.consumedAt), gt(phoneOtps.expiresAt, new Date())))
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);
  if (!row) throw new UserError("انتهت صلاحية الرمز. اطلب رمزاً جديداً.");
  if (row.attempts >= MAX_ATTEMPTS) throw new UserError("تجاوزت عدد المحاولات. اطلب رمزاً جديداً.");
  const expected = Buffer.from(row.codeHash);
  const actual = Buffer.from(hashCode(phone, String(code).trim()));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await db.update(phoneOtps).set({ attempts: row.attempts + 1 }).where(eq(phoneOtps.id, row.id));
    throw new UserError("الرمز غير صحيح.");
  }
  const token = randomBytes(24).toString("base64url");
  await db
    .update(phoneOtps)
    .set({ verifiedTokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) })
    .where(eq(phoneOtps.id, row.id));
  return { phone, otpToken: token };
}

/** Use a verification token once. Returns true if it is valid for this phone and purpose. */
export async function consumeOtpToken(phone: string, purpose: OtpPurpose, token: string | undefined | null) {
  if (!token) return false;
  const rows = await db
    .update(phoneOtps)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(phoneOtps.phone, phone),
        eq(phoneOtps.purpose, purpose),
        eq(phoneOtps.verifiedTokenHash, hashToken(token)),
        isNull(phoneOtps.consumedAt),
        gt(phoneOtps.expiresAt, new Date()),
      ),
    )
    .returning({ id: phoneOtps.id });
  return rows.length > 0;
}
