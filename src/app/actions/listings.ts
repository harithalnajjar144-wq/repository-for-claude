"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toActionError, UserError, type ActionState } from "@/lib/errors";
import { saveImages } from "@/lib/uploads";
import { formObject } from "@/lib/validation";
import {
  createListing,
  createReport,
  featureListing,
  getOwnListing,
  setFavorite,
  setListingStatus,
  updateListing,
} from "@/lib/services/listings";

export async function createListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireUser();
    const images = await saveImages(fd.getAll("images"));
    id = (await createListing(user, formObject(fd), images)).id;
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/listings");
  redirect(`/listings/${id}?created=1`);
}

export async function updateListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = Number(fd.get("id"));
  try {
    const user = await requireUser();
    const l = await getOwnListing(user, id);
    const keep = fd.getAll("keepImages").map(String).filter((u) => l.images.includes(u));
    const added = await saveImages(fd.getAll("images"), 8 - keep.length);
    await updateListing(user, id, formObject(fd), [...keep, ...added]);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(`/listings/${id}`);
  redirect(`/listings/${id}`);
}

export async function setListingStatusAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  try {
    await setListingStatus(user, id, String(fd.get("status")));
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
  }
  revalidatePath("/dashboard/listings");
  revalidatePath(`/listings/${id}`);
}

export async function featureListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const id = Number(fd.get("id"));
    await featureListing(user, id);
    revalidatePath(`/listings/${id}`);
    return { ok: true, message: "تم تمييز الإعلان لمدة 7 أيام وسيظهر في أعلى النتائج." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleFavoriteAction(fd: FormData) {
  const user = await requireUser();
  const listingId = Number(fd.get("id"));
  try {
    await setFavorite(user.id, listingId);
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
  }
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/dashboard/favorites");
}

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    await createReport(user, formObject(fd));
    return { ok: true, message: "شكراً لك. وصل البلاغ إلى فريق الإدارة وسيتم مراجعته." };
  } catch (e) {
    return toActionError(e);
  }
}
