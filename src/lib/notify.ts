import { db, type Tx } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(
  userId: number,
  title: string,
  body?: string,
  link?: string,
  tx?: Tx,
) {
  await (tx ?? db).insert(notifications).values({ userId, title, body, link });
}
