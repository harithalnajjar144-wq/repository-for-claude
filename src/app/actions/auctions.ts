"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auctions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ANIMAL_CATEGORIES, GOVERNORATES } from "@/lib/constants";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { assertCanCreateAuction } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { saveImages } from "@/lib/uploads";
import {
  cancelAuction,
  completeAuction,
  defaultIncrement,
  joinAuction,
  placeBid,
  requiredDeposit,
} from "@/lib/auctions";
import { iqd } from "@/lib/format";

const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/,/g, ""))),
  z.number().int().min(0).optional(),
);

const schema = z.object({
  title: z.string().trim().min(5, "العنوان قصير جداً").max(160),
  description: z.string().trim().min(10, "أضف وصفاً أوضح").max(5000),
  category: z.enum(ANIMAL_CATEGORIES.map((c) => c.key) as [string, ...string[]], { message: "اختر نوع الحيوان" }),
  breed: z.string().trim().max(80).optional(),
  ageMonths: optInt,
  gender: z.enum(["male", "female", "mixed", "unknown"]),
  weightKg: optInt,
  quantity: z.preprocess((v) => Number(v || 1), z.number().int().min(1).max(10000)),
  city: z.enum(GOVERNORATES.map((g) => g.key) as [string, ...string[]], { message: "اختر المحافظة" }),
  startPrice: z.preprocess((v) => Number(v), z.number().int("سعر البداية غير صحيح").min(10000, "أقل سعر بداية 10,000 د.ع")),
  minIncrement: optInt,
  reservePrice: optInt,
  depositAmount: optInt,
  startMode: z.enum(["now", "scheduled"]),
  startsAt: z.string().optional(),
  durationHours: z.preprocess((v) => Number(v), z.number().int().min(1).max(24 * 14)),
});

export async function createAuctionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireUser();
    if (user.role === "user" || user.role === "vet" || user.role === "shop")
      throw new UserError("فتح المزادات متاح لحسابات التجار والمربين فقط.");
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const d = parsed.data;
    await assertCanCreateAuction(user.id);
    const s = await getSettings();

    let startsAt = new Date();
    if (d.startMode === "scheduled") {
      // datetime-local is entered in Baghdad time (UTC+3)
      if (!d.startsAt) throw new UserError("حدد وقت بدء المزاد.");
      startsAt = new Date(`${d.startsAt}:00+03:00`);
      if (Number.isNaN(startsAt.getTime())) throw new UserError("وقت البدء غير صحيح.");
      if (startsAt.getTime() < Date.now() - 60_000) throw new UserError("وقت البدء يجب أن يكون في المستقبل.");
      if (startsAt.getTime() > Date.now() + 30 * 86400_000) throw new UserError("لا يمكن جدولة مزاد بعد أكثر من 30 يوماً.");
    }
    const endsAt = new Date(startsAt.getTime() + d.durationHours * 3600_000);
    const minIncrement = d.minIncrement && d.minIncrement >= 1000 ? d.minIncrement : defaultIncrement(d.startPrice);
    if (d.reservePrice && d.reservePrice < d.startPrice) throw new UserError("السعر الأدنى المخفي يجب أن يكون أعلى من سعر البداية.");
    const deposit = requiredDeposit(d.startPrice, d.depositAmount ?? 0, s.minDepositRate, s.minDepositAmount);
    const images = await saveImages(fd.getAll("images"));
    if (!images.length) throw new UserError("أضف صورة واحدة على الأقل.");

    const [row] = await db
      .insert(auctions)
      .values({
        sellerId: user.id,
        title: d.title,
        description: d.description,
        category: d.category,
        breed: d.breed || null,
        ageMonths: d.ageMonths ?? null,
        gender: d.gender,
        weightKg: d.weightKg ?? null,
        quantity: d.quantity,
        city: d.city,
        images,
        startPrice: d.startPrice,
        minIncrement,
        reservePrice: d.reservePrice || null,
        depositAmount: deposit,
        commissionRate: String(s.auctionCommissionRate),
        startsAt,
        endsAt,
        status: d.startMode === "now" ? "live" : "scheduled",
      })
      .returning({ id: auctions.id });
    id = row.id;
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/auctions");
  redirect(`/auctions/${id}?created=1`);
}

export async function joinAuctionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const dep = await joinAuction(user.id, Number(fd.get("auctionId")));
    revalidatePath(`/auctions/${fd.get("auctionId")}`);
    return { ok: true, message: `تم حجز التأمين (${iqd(dep.amount)}). يمكنك المزايدة الآن.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function placeBidAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const amount = Number(String(fd.get("amount") ?? "").replace(/[,\s]/g, ""));
    const r = await placeBid(user.id, Number(fd.get("auctionId")), amount);
    return {
      ok: true,
      message: `تم تسجيل مزايدتك بقيمة ${iqd(r.amount)}.${r.extended ? " تم تمديد المزاد دقيقتين." : ""}`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completeAuctionAction(fd: FormData) {
  const user = await requireUser();
  await completeAuction(user.id, Number(fd.get("auctionId")), user.role === "admin");
  revalidatePath(`/auctions/${fd.get("auctionId")}`);
}

export async function cancelAuctionAction(fd: FormData) {
  const user = await requireUser();
  await cancelAuction(user.id, Number(fd.get("auctionId")), user.role === "admin");
  revalidatePath(`/auctions/${fd.get("auctionId")}`);
}

