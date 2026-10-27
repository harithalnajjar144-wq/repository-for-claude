import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

const COOKIE = "halali_session";
const WEB_SESSION_DAYS = 30;
/** Mobile tokens last 90 days and are extended while the app is in use. */
const MOBILE_SESSION_DAYS = 90;
const DAY = 86400_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** Create a session row and return the raw token (only its hash is stored). */
export async function issueSessionToken(userId: number, client: "web" | "mobile", deviceName?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const days = client === "mobile" ? MOBILE_SESSION_DAYS : WEB_SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * DAY);
  await db.insert(sessions).values({ id: hashToken(token), userId, client, deviceName: deviceName?.slice(0, 120) || null, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function revokeSessionToken(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Web login: issue a session and set the cookie. */
export async function createSession(userId: number) {
  const { token, expiresAt } = await issueSessionToken(userId, "web");
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  jar.delete(COOKIE);
}

/** The raw session token of this request: `Authorization: Bearer …` (mobile) or the cookie (web). */
export async function currentToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export type SessionUser = Omit<User, "passwordHash">;

/** Look up the user behind a raw token. Extends mobile sessions that are in use. */
export async function userForToken(token: string): Promise<SessionUser | null> {
  const id = hashToken(token);
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.isBanned) return null;
  // Touch at most hourly; slide mobile expiry.
  if (Date.now() - row.session.lastUsedAt.getTime() > 3600_000) {
    await db
      .update(sessions)
      .set({
        lastUsedAt: new Date(),
        ...(row.session.client === "mobile" ? { expiresAt: new Date(Date.now() + MOBILE_SESSION_DAYS * DAY) } : {}),
      })
      .where(eq(sessions.id, id));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = row.user;
  return safe;
}

/** Current signed-in user (cached per request), or null. Works for cookies and Bearer tokens. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await currentToken();
  return token ? userForToken(token) : null;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser("/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}

export async function requireRole(roles: SessionUser["role"][], next?: string) {
  const u = await requireUser(next);
  if (!roles.includes(u.role) && u.role !== "admin") redirect("/dashboard");
  return u;
}
