"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ads, listings, plans, reports, sessions, topupRequests, users, verificationRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { iqd } from "@/lib/format";
import { notify } from "@/lib/notify";
import { DEFAULT_SETTINGS, setSetting, type SettingKey } from "@/lib/settings";
import { saveImage } from "@/lib/uploads";
import { moveFunds } from "@/lib/wallet";
import { cancelAuction, completeAuction, forfeitWinner } from "@/lib/auctions";

const ROLES = ["user", "trader", "vet", "shop", "admin"] as const;

export async function reviewVerificationAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  const decision = fd.get("decision") === "approve" ? "verified" : "rejected";
  const note = String(fd.get("note") ?? "").trim() || null;
  const [req] = await db.select().from(verificationRequests).where(eq(verificationRequests.id, id));
  if (!req || req.status !== "pending") return;
  await db.transaction(async (tx) => {
    await tx
      .update(verificationRequests)
      .set({ status: decision, adminNote: note, reviewedBy: admin.id, reviewedAt: new Date() })
      .where(eq(verificationRequests.id, id));
    await tx.update(users).set({ verificationStatus: decision }).where(eq(users.id, req.userId));
    await notify(
      req.userId,
      decision === "verified" ? "✓ تم توثيق حسابك" : "تعذر توثيق حسابك",
      decision === "verified" ? "أصبح بإمكانك المشاركة في المزادات وتظهر شارة التوثيق بجانب اسمك." : note ?? "يرجى مراجعة البيانات وإعادة التقديم.",
      "/dashboard/profile#verify",
      tx,
    );
  });
  revalidatePath("/admin/verifications");
}

export async function updateUserAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  const op = String(fd.get("op"));
  if (id === admin.id && (op === "ban" || op === "role")) return; // don't lock yourself out
  if (op === "ban" || op === "unban") {
    await db.update(users).set({ isBanned: op === "ban" }).where(eq(users.id, id));
    if (op === "ban") await db.delete(sessions).where(eq(sessions.userId, id));
  } else if (op === "role") {
    const role = String(fd.get("role")) as (typeof ROLES)[number];
    if (ROLES.includes(role)) await db.update(users).set({ role }).where(eq(users.id, id));
  } else if (op === "unverify") {
    await db.update(users).set({ verificationStatus: "none" }).where(eq(users.id, id));
  }
  revalidatePath("/admin/users");
}

export async function adjustWalletAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const userId = Number(fd.get("userId"));
    const amount = Math.trunc(Number(fd.get("amount")));
    const note = String(fd.get("note") ?? "").trim();
    if (!amount) throw new UserError("أدخل مبلغاً (موجب للإضافة، سالب للخصم).");
    if (!note) throw new UserError("أدخل سبب التسوية.");
    await db.transaction((tx) => moveFunds(tx, { userId, amount, type: "adjustment", note, allowNegative: true }));
    await notify(userId, "تسوية في المحفظة", `${amount > 0 ? "إضافة" : "خصم"} ${iqd(Math.abs(amount))}: ${note}`, "/dashboard/wallet");
    revalidatePath("/admin/users");
    return { ok: true, message: "تمت التسوية." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reviewTopupAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") ?? "").trim() || null;
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(topupRequests).where(and(eq(topupRequests.id, id), eq(topupRequests.status, "pending"))).for("update");
    if (!t) return;
    await tx.update(topupRequests).set({ status: approve ? "approved" : "rejected", adminNote: note, reviewedBy: admin.id }).where(eq(topupRequests.id, id));
    if (approve)
      await moveFunds(tx, { userId: t.userId, amount: t.amount, type: "topup", reference: `topup:${t.id}`, note: `شحن عبر ${t.method}${t.transferRef ? ` (${t.transferRef})` : ""}` });
    await notify(t.userId, approve ? "تم شحن محفظتك ✓" : "تعذر تأكيد عملية الشحن", approve ? `أضيف ${iqd(t.amount)} إلى رصيدك.` : note ?? "لم نتمكن من التحقق من التحويل.", "/dashboard/wallet", tx);
  });
  revalidatePath("/admin/topups");
}

export async function moderateListingAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const status = String(fd.get("status")) as "active" | "hidden" | "removed";
  if (!["active", "hidden", "removed"].includes(status)) return;
  const [l] = await db.update(listings).set({ status }).where(eq(listings.id, id)).returning();
  if (l && status !== "active") await notify(l.userId, "تم إيقاف إعلانك", `إعلان "${l.title}" أوقف من قبل الإدارة لمخالفته شروط النشر.`, `/listings/${l.id}`);
  revalidatePath("/admin/listings");
}

export async function adminAuctionAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  const op = String(fd.get("op"));
  if (op === "forfeit") await forfeitWinner(id, String(fd.get("note") ?? "") || undefined);
  else if (op === "complete") await completeAuction(admin.id, id, true);
  else if (op === "cancel") await cancelAuction(admin.id, id, true);
  revalidatePath("/admin/auctions");
}

export async function resolveReportAction(fd: FormData) {
  await requireAdmin();
  const status = fd.get("status") === "resolved" ? "resolved" : "dismissed";
  await db
    .update(reports)
    .set({ status, adminNote: String(fd.get("note") ?? "") || null })
    .where(eq(reports.id, Number(fd.get("id"))));
  revalidatePath("/admin/reports");
}

export async function savePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = Number(fd.get("id")) || undefined;
    const role = String(fd.get("role")) as (typeof ROLES)[number];
    if (!ROLES.includes(role)) throw new UserError("نوع الحساب غير صحيح.");
    const name = String(fd.get("name") ?? "").trim();
    const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
    if (!name || !/^[a-z0-9-]{2,40}$/.test(slug)) throw new UserError("أدخل الاسم ومعرّفاً إنجليزياً (حروف صغيرة وأرقام وشرطة).");
    const lim = (k: string) => (String(fd.get(k) ?? "").trim() === "" ? null : Math.max(0, Number(fd.get(k))));
    const values = {
      name,
      slug,
      role,
      priceMonthly: Math.max(0, Math.trunc(Number(fd.get("priceMonthly")) || 0)),
      maxActiveListings: lim("maxActiveListings"),
      maxActiveAuctions: lim("maxActiveAuctions"),
      features: String(fd.get("features") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
      sortOrder: Number(fd.get("sortOrder")) || 0,
      isActive: fd.get("isActive") === "on",
    };
    if (id) await db.update(plans).set(values).where(eq(plans.id, id));
    else await db.insert(plans).values(values);
    revalidatePath("/admin/plans");
    return { ok: true, message: "تم حفظ الباقة." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveAdAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = Number(fd.get("id")) || undefined;
    const title = String(fd.get("title") ?? "").trim();
    if (!title) throw new UserError("أدخل عنوان الإعلان.");
    const link = String(fd.get("linkUrl") ?? "").trim();
    if (link && !/^(https?:\/\/|\/)/.test(link)) throw new UserError("الرابط يجب أن يبدأ بـ https:// أو /");
    const img = fd.get("image");
    const imageUrl = img && typeof img === "object" && img.size > 0 ? await saveImage(img) : undefined;
    const endsAt = String(fd.get("endsAt") ?? "");
    const values = {
      title,
      subtitle: String(fd.get("subtitle") ?? "").trim() || null,
      linkUrl: link || null,
      advertiser: String(fd.get("advertiser") ?? "").trim() || null,
      placement: ["home_top", "listings_side"].includes(String(fd.get("placement"))) ? String(fd.get("placement")) : "home_top",
      endsAt: endsAt ? new Date(`${endsAt}T23:59:59+03:00`) : null,
      isActive: fd.get("isActive") === "on",
      ...(imageUrl ? { imageUrl } : {}),
    };
    if (id) await db.update(ads).set(values).where(eq(ads.id, id));
    else await db.insert(ads).values(values);
    revalidatePath("/admin/ads");
    revalidatePath("/");
    return { ok: true, message: "تم حفظ الإعلان." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
      const def = DEFAULT_SETTINGS[key];
      if (typeof def === "boolean") {
        await setSetting(key, (fd.get(key) === "on") as never);
        continue;
      }
      const raw = fd.get(key);
      if (raw === null) continue;
      if (typeof def === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new UserError(`قيمة غير صحيحة: ${key}`);
        await setSetting(key, n as never);
      } else await setSetting(key, String(raw).trim() as never);
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "تم حفظ الإعدادات. تنطبق نسبة العمولة على المزادات الجديدة فقط." };
  } catch (e) {
    return toActionError(e);
  }
}
