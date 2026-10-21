"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { providers, users } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { GOVERNORATES } from "@/lib/constants";
import { toActionError, UserError, type ActionState } from "@/lib/errors";

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
};

const registerSchema = z.object({
  name: z.string().trim().min(3, "الاسم قصير جداً").max(120),
  phone: z.string().trim(),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(100),
  city: z.enum(GOVERNORATES.map((g) => g.key) as [string, ...string[]], { message: "اختر المحافظة" }),
  role: z.enum(["user", "trader", "vet", "shop"]),
  businessName: z.string().trim().max(160).optional(),
});

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const parsed = registerSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const d = parsed.data;
    const phone = normalizePhone(d.phone);
    if (!phone) throw new UserError("رقم الهاتف غير صحيح. مثال: 07701234567");
    if ((d.role === "vet" || d.role === "shop") && !d.businessName)
      throw new UserError(d.role === "vet" ? "أدخل اسم العيادة أو الطبيب." : "أدخل اسم المحل.");
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
    if (exists.length) throw new UserError("هذا الرقم مسجل مسبقاً. سجّل الدخول بدلاً من ذلك.");
    const [u] = await db
      .insert(users)
      .values({
        name: d.name,
        phone,
        whatsapp: phone,
        passwordHash: await hashPassword(d.password),
        city: d.city,
        role: d.role,
      })
      .returning({ id: users.id });
    if (d.role === "vet" || d.role === "shop") {
      await db.insert(providers).values({
        userId: u.id,
        kind: d.role,
        businessName: d.businessName!,
        city: d.city,
        phone,
        whatsapp: phone,
      });
    }
    await createSession(u.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect(safeNext(fd.get("next")) === "/dashboard" ? "/dashboard?welcome=1" : safeNext(fd.get("next")));
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const phone = normalizePhone(String(fd.get("phone") ?? ""));
    const password = String(fd.get("password") ?? "");
    if (!phone || !password) throw new UserError("أدخل رقم الهاتف وكلمة المرور.");
    const [u] = await db.select().from(users).where(eq(users.phone, phone));
    if (!u || !(await verifyPassword(password, u.passwordHash)))
      throw new UserError("رقم الهاتف أو كلمة المرور غير صحيحة.");
    if (u.isBanned) throw new UserError("تم إيقاف هذا الحساب. تواصل مع الدعم.");
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
