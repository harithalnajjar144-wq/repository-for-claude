"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications, topupRequests, users, verificationRequests } from "@/db/schema";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { GOVERNORATES, TOPUP_METHODS } from "@/lib/constants";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { normalizePhone, iqd } from "@/lib/format";
import { subscribe } from "@/lib/plans";
import { saveImage, saveImages } from "@/lib/uploads";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const s = z
      .object({
        name: z.string().trim().min(3, "الاسم قصير جداً").max(120),
        city: z.enum(GOVERNORATES.map((g) => g.key) as [string, ...string[]]),
        whatsapp: z.string().trim().optional(),
        email: z.union([z.literal(""), z.email("البريد الإلكتروني غير صحيح")]).optional(),
        bio: z.string().trim().max(1000).optional(),
      })
      .safeParse(Object.fromEntries(fd));
    if (!s.success) throw new UserError(s.error.issues[0].message);
    const whatsapp = s.data.whatsapp ? normalizePhone(s.data.whatsapp) : null;
    if (s.data.whatsapp && !whatsapp) throw new UserError("رقم الواتساب غير صحيح.");
    // Changing the name after verification would bypass the identity check.
    const name = user.verificationStatus === "verified" ? user.name : s.data.name;
    await db
      .update(users)
      .set({ name, city: s.data.city, whatsapp, email: s.data.email || null, bio: s.data.bio || null })
      .where(eq(users.id, user.id));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: user.verificationStatus === "verified" && s.data.name !== user.name ? "تم الحفظ. لا يمكن تغيير الاسم بعد التوثيق." : "تم حفظ الملف الشخصي." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    if (next.length < 8) throw new UserError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    if (!(await verifyPassword(current, u.passwordHash))) throw new UserError("كلمة المرور الحالية غير صحيحة.");
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
    return { ok: true, message: "تم تغيير كلمة المرور." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    if (user.verificationStatus === "verified") throw new UserError("حسابك موثق مسبقاً.");
    if (user.verificationStatus === "pending") throw new UserError("طلبك قيد المراجعة.");
    const fullName = String(fd.get("fullName") ?? "").trim();
    const documentType = String(fd.get("documentType") ?? "");
    if (fullName.length < 6) throw new UserError("أدخل الاسم الرباعي كما في المستمسك.");
    if (!["national_id", "passport", "residence"].includes(documentType)) throw new UserError("اختر نوع المستمسك.");
    const documentImages = await saveImages(fd.getAll("documentImages"), 2, { private: true });
    if (!documentImages.length) throw new UserError("ارفع صورة المستمسك (الوجه الأمامي على الأقل).");
    const licenseImage = await saveImage(fd.get("licenseImage"), { private: true });
    if ((user.role === "vet" || user.role === "shop") && !licenseImage)
      throw new UserError(user.role === "vet" ? "ارفع صورة إجازة ممارسة المهنة البيطرية." : "ارفع صورة إجازة المحل أو الهوية التجارية.");
    await db.insert(verificationRequests).values({
      userId: user.id,
      fullName,
      documentType,
      documentImages,
      licenseImage,
      note: String(fd.get("note") ?? "").slice(0, 1000) || null,
    });
    await db.update(users).set({ verificationStatus: "pending" }).where(eq(users.id, user.id));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم إرسال طلب التوثيق. تتم المراجعة عادة خلال 24 ساعة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestTopupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const amount = Math.floor(Number(fd.get("amount")));
    const method = String(fd.get("method"));
    if (!Number.isFinite(amount) || amount < 5000) throw new UserError("أقل مبلغ للشحن 5,000 د.ع.");
    if (amount > 100_000_000) throw new UserError("المبلغ كبير جداً. تواصل مع الدعم.");
    if (!TOPUP_METHODS.some((m) => m.key === method)) throw new UserError("اختر طريقة الدفع.");
    const transferRef = String(fd.get("transferRef") ?? "").trim().slice(0, 120);
    const receiptImage = await saveImage(fd.get("receipt"), { private: true });
    if (method !== "cash" && !transferRef && !receiptImage) throw new UserError("أدخل رقم الحوالة أو ارفع صورة الإيصال.");
    await db.insert(topupRequests).values({ userId: user.id, amount, method, transferRef: transferRef || null, receiptImage });
    revalidatePath("/dashboard/wallet");
    return { ok: true, message: `تم استلام طلب شحن ${iqd(amount)}. سيُضاف الرصيد بعد التحقق من التحويل.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function subscribeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const months = [1, 3, 6, 12].includes(Number(fd.get("months"))) ? Number(fd.get("months")) : 1;
    const end = await subscribe(user.id, Number(fd.get("planId")), months);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: `تم الاشتراك بنجاح حتى ${end.toLocaleDateString("ar-IQ-u-nu-latn")}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markAllReadAction() {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  revalidatePath("/", "layout");
}
