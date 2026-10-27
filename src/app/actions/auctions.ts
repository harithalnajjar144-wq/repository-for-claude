"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { saveImages } from "@/lib/uploads";
import { formObject } from "@/lib/validation";
import { cancelAuction, completeAuction, joinAuction, placeBid } from "@/lib/auctions";
import { createAuction } from "@/lib/services/auctions";
import { iqd } from "@/lib/format";

export async function createAuctionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireUser();
    if (user.role === "user" || user.role === "vet" || user.role === "shop")
      throw new UserError("فتح المزادات متاح لحسابات التجار والمربين فقط.");
    const images = await saveImages(fd.getAll("images"));
    id = (await createAuction(user, formObject(fd), images)).id;
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
