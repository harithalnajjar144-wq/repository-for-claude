import { db, type Tx } from "@/db";
import { notifications } from "@/db/schema";
import { schedulePushDelivery } from "./push";

/** Save an in-app notification; it is also pushed to the user's phones (see push.ts). */
export async function notify(userId: number, title: string, body?: string, link?: string, tx?: Tx) {
  await (tx ?? db).insert(notifications).values({ userId, title, body, link });
  schedulePushDelivery();
}
