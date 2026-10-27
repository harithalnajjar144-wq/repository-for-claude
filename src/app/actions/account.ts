"use server";

import { revalidatePath } from "next/cache";
import { currentToken, requireUser } from "@/lib/auth";
import { toActionError, type ActionState } from "@/lib/errors";
import { subscribe } from "@/lib/plans";
import { saveImage, saveImages } from "@/lib/uploads";
import { formObject } from "@/lib/validation";
import { changePassword, markNotificationsRead, requestTopup, requestVerification, updateProfile } from "@/lib/services/account";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { nameLocked } = await updateProfile(await requireUser(), formObject(fd));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: nameLocked ? "تم الحفظ. لا يمكن تغيير الاسم بعد التوثيق." : "تم حفظ الملف الشخصي." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await changePassword(await requireUser(), String(fd.get("current") ?? ""), String(fd.get("next") ?? ""), await currentToken());
    return { ok: true, message: "تم تغيير كلمة المرور." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const documentImages = await saveImages(fd.getAll("documentImages"), 2, { private: true, userId: user.id });
    const licenseImage = await saveImage(fd.get("licenseImage"), { private: true, userId: user.id });
    await requestVerification(user, { ...formObject(fd), documentImages, licenseImage: licenseImage ?? undefined });
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "تم إرسال طلب التوثيق. تتم المراجعة عادة خلال 24 ساعة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestTopupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const receiptImage = await saveImage(fd.get("receipt"), { private: true, userId: user.id });
    const { message } = await requestTopup(user, { ...formObject(fd), receipt: undefined, receiptImage: receiptImage ?? undefined });
    revalidatePath("/dashboard/wallet");
    return { ok: true, message };
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
  await markNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
