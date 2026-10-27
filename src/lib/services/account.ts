import { and, count, desc, eq, gt, inArray, ne, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  auctionDeposits,
  notifications,
  providers,
  securityEvents,
  sessions,
  topupRequests,
  users,
  verificationRequests,
  walletTransactions,
  type User,
} from "@/db/schema";
import { hashPassword, hashToken, verifyPassword, type SessionUser } from "../auth";
import { UserError } from "../errors";
import { iqd, normalizePhone } from "../format";
import { consumeOtpToken, otpRequired } from "../otp";
import { getActiveSubscription } from "../plans";
import { assertUploadedImages } from "../uploads";
import { parse, profileInput, registerInput, topupInput, verificationInput } from "../validation";

export const publicUser = (u: User | SessionUser) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = u as User;
  return rest;
};

// ---------- Sign-up & login ----------

export async function registerUser(input: unknown) {
  const d = parse(registerInput, input);
  const phone = normalizePhone(d.phone);
  if (!phone) throw new UserError("رقم الهاتف غير صحيح. مثال: 07701234567");
  if ((d.role === "vet" || d.role === "shop") && !d.businessName)
    throw new UserError(d.role === "vet" ? "أدخل اسم العيادة أو الطبيب." : "أدخل اسم المحل.");
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (exists.length) throw new UserError("هذا الرقم مسجل مسبقاً. سجّل الدخول بدلاً من ذلك.");
  let phoneVerifiedAt: Date | null = null;
  if (otpRequired()) {
    if (!(await consumeOtpToken(phone, "register", d.otpToken))) throw new UserError("أكّد رقم هاتفك برمز التحقق أولاً.");
    phoneVerifiedAt = new Date();
  }
  const validPhone: string = phone;
  const insertUser = () =>
    db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          name: d.name,
          phone: validPhone,
          whatsapp: validPhone,
          passwordHash: await hashPassword(d.password),
          city: d.city,
          role: d.role,
          phoneVerifiedAt,
        })
        .returning();
      if (d.role === "vet" || d.role === "shop")
        await tx
          .insert(providers)
          .values({ userId: u.id, kind: d.role, businessName: d.businessName!, city: d.city, phone: validPhone, whatsapp: validPhone });
      return u;
    });
  try {
    return await insertUser();
  } catch (e) {
    // Two sign-ups with the same number at the same moment: the unique index decides.
    const code = (e as { code?: string; cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
    if (code === "23505") throw new UserError("هذا الرقم مسجل مسبقاً. سجّل الدخول بدلاً من ذلك.");
    throw e;
  }
}

const LOGIN_FAILS_MAX = 10;
const LOGIN_FAILS_WINDOW_MS = 15 * 60_000;

/** Phone + password check, with a per-account lockout after repeated failures (web and app). */
export async function authenticate(rawPhone: string, password: string) {
  const phone = normalizePhone(rawPhone ?? "");
  if (!phone || !password) throw new UserError("أدخل رقم الهاتف وكلمة المرور.");
  const key = `login_fail:${phone}`;
  const [{ n }] = await db
    .select({ n: count() })
    .from(securityEvents)
    .where(and(eq(securityEvents.key, key), gt(securityEvents.createdAt, new Date(Date.now() - LOGIN_FAILS_WINDOW_MS))));
  if (n >= LOGIN_FAILS_MAX) throw new UserError("محاولات دخول كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى، أو استعد كلمة المرور.");
  const [u] = await db.select().from(users).where(eq(users.phone, phone));
  if (!u || !(await verifyPassword(password, u.passwordHash))) {
    await db.insert(securityEvents).values({ key });
    throw new UserError("رقم الهاتف أو كلمة المرور غير صحيحة.");
  }
  if (u.isBanned) throw new UserError("تم إيقاف هذا الحساب. تواصل مع الدعم.");
  return u;
}

export async function resetPassword(rawPhone: string, otpToken: string, newPassword: string) {
  const phone = normalizePhone(rawPhone ?? "");
  if (!phone) throw new UserError("رقم الهاتف غير صحيح.");
  if ((newPassword ?? "").length < 8) throw new UserError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
  if (!(await consumeOtpToken(phone, "reset", otpToken))) throw new UserError("رمز التحقق غير صالح أو منتهي.");
  const [u] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), phoneVerifiedAt: new Date() })
    .where(eq(users.phone, phone))
    .returning();
  if (!u) throw new UserError("لا يوجد حساب بهذا الرقم.");
  // Sign out every device (the caller issues a fresh session) and clear the lockout.
  await db.delete(sessions).where(eq(sessions.userId, u.id));
  await db.delete(securityEvents).where(eq(securityEvents.key, `login_fail:${phone}`));
  return u;
}

// ---------- Profile ----------

export async function updateProfile(user: SessionUser, input: unknown) {
  const d = parse(profileInput, input);
  const whatsapp = d.whatsapp ? normalizePhone(d.whatsapp) : null;
  if (d.whatsapp && !whatsapp) throw new UserError("رقم الواتساب غير صحيح.");
  // Changing the name after verification would bypass the identity check.
  const nameLocked = user.verificationStatus === "verified";
  const name = nameLocked ? user.name : d.name;
  const [u] = await db
    .update(users)
    .set({ name, city: d.city, whatsapp, email: d.email || null, bio: d.bio || null })
    .where(eq(users.id, user.id))
    .returning();
  return { user: publicUser(u), nameLocked: nameLocked && d.name !== user.name };
}

/** Changes the password and signs out every other device. `currentToken` is the session to keep. */
export async function changePassword(user: SessionUser, current: string, next: string, currentToken?: string | null) {
  if ((next ?? "").length < 8) throw new UserError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
  const [u] = await db.select().from(users).where(eq(users.id, user.id));
  if (!(await verifyPassword(current ?? "", u.passwordHash))) throw new UserError("كلمة المرور الحالية غير صحيحة.");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), currentToken ? ne(sessions.id, hashToken(currentToken)) : undefined));
}

/** Image fields are URLs from POST /api/v1/uploads?private=1 (API) or already-saved files (web). */
export async function requestVerification(user: SessionUser, input: unknown) {
  if (user.verificationStatus === "verified") throw new UserError("حسابك موثق مسبقاً.");
  if (user.verificationStatus === "pending") throw new UserError("طلبك قيد المراجعة.");
  const d = parse(verificationInput, input);
  const documentImages = await assertUploadedImages(d.documentImages, { private: true, max: 2, userId: user.id });
  if (!documentImages.length) throw new UserError("ارفع صورة المستمسك (الوجه الأمامي على الأقل).");
  const [licenseImage] = d.licenseImage ? await assertUploadedImages([d.licenseImage], { private: true, max: 1, userId: user.id }) : [null];
  if ((user.role === "vet" || user.role === "shop") && !licenseImage)
    throw new UserError(user.role === "vet" ? "ارفع صورة إجازة ممارسة المهنة البيطرية." : "ارفع صورة إجازة المحل أو الهوية التجارية.");
  await db.transaction(async (tx) => {
    await tx.insert(verificationRequests).values({
      userId: user.id,
      fullName: d.fullName,
      documentType: d.documentType,
      documentImages,
      licenseImage,
      note: d.note || null,
    });
    await tx.update(users).set({ verificationStatus: "pending" }).where(eq(users.id, user.id));
  });
}

export async function latestVerificationRequest(userId: number) {
  const [r] = await db
    .select({ status: verificationRequests.status, adminNote: verificationRequests.adminNote, createdAt: verificationRequests.createdAt })
    .from(verificationRequests)
    .where(eq(verificationRequests.userId, userId))
    .orderBy(desc(verificationRequests.createdAt))
    .limit(1);
  return r ?? null;
}

// ---------- Wallet ----------

export async function requestTopup(user: SessionUser, input: unknown) {
  const d = parse(topupInput, input);
  const [receiptImage] = d.receiptImage ? await assertUploadedImages([d.receiptImage], { private: true, max: 1, userId: user.id }) : [null];
  if (d.method !== "cash" && !d.transferRef && !receiptImage) throw new UserError("أدخل رقم الحوالة أو ارفع صورة الإيصال.");
  const [t] = await db
    .insert(topupRequests)
    .values({ userId: user.id, amount: d.amount, method: d.method, transferRef: d.transferRef || null, receiptImage })
    .returning();
  return { topup: t, message: `تم استلام طلب شحن ${iqd(d.amount)}. سيُضاف الرصيد بعد التحقق من التحويل.` };
}

export async function getWallet(userId: number) {
  const [[u], txs, topups, [held]] = await Promise.all([
    db.select({ balance: users.walletBalance }).from(users).where(eq(users.id, userId)),
    db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.id)).limit(100),
    db
      .select({
        id: topupRequests.id,
        amount: topupRequests.amount,
        method: topupRequests.method,
        transferRef: topupRequests.transferRef,
        status: topupRequests.status,
        adminNote: topupRequests.adminNote,
        createdAt: topupRequests.createdAt,
      })
      .from(topupRequests)
      .where(eq(topupRequests.userId, userId))
      .orderBy(desc(topupRequests.createdAt))
      .limit(20),
    db.select({ total: sum(auctionDeposits.amount) }).from(auctionDeposits).where(and(eq(auctionDeposits.userId, userId), eq(auctionDeposits.status, "held"))),
  ]);
  return { balance: u.balance, heldDeposits: Number(held.total ?? 0), transactions: txs, topups };
}

// ---------- Overview ----------

export async function getMe(user: SessionUser) {
  const [[{ unread }], sub, prov, verification] = await Promise.all([
    db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
    getActiveSubscription(user.id),
    db.select().from(providers).where(eq(providers.userId, user.id)),
    latestVerificationRequest(user.id),
  ]);
  return {
    user: publicUser(user),
    unreadNotifications: unread,
    subscription: sub ? { plan: sub.plan, endsAt: sub.sub.endsAt } : null,
    business: prov[0] ?? null,
    lastVerificationRequest: verification,
  };
}

export async function listNotifications(userId: number, page = 1) {
  const limit = 50;
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset((Math.max(1, page) - 1) * limit);
}

export async function markNotificationsRead(userId: number, ids?: number[]) {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        ids?.length ? inArray(notifications.id, ids) : undefined,
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}
