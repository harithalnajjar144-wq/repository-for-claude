/**
 * Push notifications through Expo's push service.
 *
 * notify() writes a row to `notifications`; rows with pushed_at = NULL form a queue.
 * deliverPendingPushes() claims queued rows (after their transaction committed) and
 * sends them to the user's registered devices. It runs a moment after each notify()
 * and on the server's one-minute timer, so nothing is lost if a send fails.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { UserError } from "./errors";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

export async function registerPushToken(userId: number, token: string, platform: string) {
  if (!TOKEN_RE.test(token)) throw new UserError("رمز الإشعارات غير صالح.");
  const p = platform === "ios" ? "ios" : "android";
  await db
    .insert(pushTokens)
    .values({ userId, token, platform: p })
    .onConflictDoUpdate({ target: pushTokens.token, set: { userId, platform: p, lastSeenAt: new Date() } });
}

export async function removePushToken(userId: number, token: string) {
  await db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Deliver queued pushes shortly (gives the creating transaction time to commit). */
export function schedulePushDelivery(delayMs = 1500) {
  if (timer || process.env.PUSH_DISABLED === "1") return;
  timer = setTimeout(() => {
    timer = null;
    deliverPendingPushes().catch((e) => console.error("[halali] push delivery failed", e));
  }, delayMs);
  timer.unref?.();
}

type Claimed = { id: number; user_id: number; title: string; body: string | null; link: string | null; fresh: boolean };

/** Send all queued notifications. Returns the number of push messages sent. */
export async function deliverPendingPushes(): Promise<number> {
  let sent = 0;
  for (;;) {
    // Claim a batch atomically so two runs never send the same notification.
    const { rows } = await db.execute<Claimed>(sql`
      update notifications n set pushed_at = now()
      from (
        select id from notifications where pushed_at is null order by id limit 300 for update skip locked
      ) q
      where n.id = q.id
      returning n.id, n.user_id, n.title, n.body, n.link, (n.created_at > now() - interval '1 day') as fresh
    `);
    if (!rows.length) break;
    const live = rows.filter((r) => r.fresh); // stale rows are just marked, not sent
    if (!live.length || process.env.PUSH_DISABLED === "1") continue;
    const tokens = await db.select().from(pushTokens).where(inArray(pushTokens.userId, [...new Set(live.map((r) => r.user_id))]));
    const messages = live.flatMap((n) =>
      tokens
        .filter((t) => t.userId === n.user_id)
        .map((t) => ({
          to: t.token,
          title: n.title,
          body: n.body ?? undefined,
          data: { link: n.link ?? null, notificationId: n.id },
          sound: "default",
          channelId: "default",
          priority: "high",
        })),
    );
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const r = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
          },
          body: JSON.stringify(chunk),
        });
        const json = (await r.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
        const dead = (json?.data ?? [])
          .map((ticket, idx) => (ticket.details?.error === "DeviceNotRegistered" ? chunk[idx].to : null))
          .filter((t): t is string => !!t);
        if (dead.length) await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
        sent += chunk.length;
      } catch (e) {
        console.error("[halali] Expo push request failed", e);
      }
    }
  }
  return sent;
}
