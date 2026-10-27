/**
 * Small HTTP layer for the mobile JSON API (/api/v1).
 * Success: { data, ...extra }   Error: { error: { code, message } } (message in Arabic).
 */
import { userForToken, type SessionUser } from "../auth";
import { UserError } from "../errors";
import { schedulePushDelivery } from "../push";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "العنصر") => new ApiError(404, "not_found", `${what} غير موجود.`);
export const forbidden = () => new ApiError(403, "forbidden", "ليس لديك صلاحية لهذا الإجراء.");

export type Ctx = {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  user: SessionUser | null;
  token: string | null;
  ip: string;
  /** Parsed JSON body (empty object if none). */
  body: () => Promise<Record<string, unknown>>;
};
export type AuthedCtx = Ctx & { user: SessionUser };

export type Handler = (ctx: Ctx) => Promise<unknown>;

/** The API uses Bearer tokens (not cookies), so any origin may call it — e.g. the app's web preview. */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS, ...headers },
  });

/** A handler's return value: data (wrapped as { data }) or a ready Response. */
export class Ok {
  constructor(
    public data: unknown,
    public extra: Record<string, unknown> = {},
    public status = 200,
  ) {}
}
export const ok = (data: unknown, extra: Record<string, unknown> = {}) => new Ok(data, extra);
export const created = (data: unknown, extra: Record<string, unknown> = {}) => new Ok(data, extra, 201);

/** Only `Authorization: Bearer` is accepted. Cookies are ignored on purpose: the API allows any
 * origin (CORS "*"), so accepting the website's cookie would let other sites act as a signed-in user. */
export function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

/**
 * Client IP as seen by our own proxy. Clients can put anything in X-Forwarded-For, but each proxy
 * appends the address it received the request from, so we read from the right: with TRUST_PROXY_HOPS=1
 * (Railway's edge) the last entry is the real client.
 */
export function clientIp(req: Request) {
  const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? 1));
  const list = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list[list.length - hops] ?? list[0] ?? req.headers.get("x-real-ip") ?? "local";
}

// ---------- Rate limiting (in-memory; fine for a single instance) ----------

const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new ApiError(429, "rate_limited", "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.");
  list.push(now);
  hits.set(key, list);
  // Drop expired entries now and then (never wipe live counters).
  if (hits.size > 20_000)
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 3600_000) hits.delete(k);
}
export const resetRateLimits = () => hits.clear();

// ---------- Body parsing ----------

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return {};
  const text = await req.text();
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    /* fall through */
  }
  throw new ApiError(400, "bad_json", "صيغة الطلب غير صحيحة.");
}

// ---------- Execution ----------

export async function run(req: Request, params: Record<string, string>, handler: Handler, auth: "required" | "optional") {
  try {
    const token = bearerToken(req);
    const user = token ? await userForToken(token) : null;
    if (auth === "required" && !user) throw new ApiError(401, "unauthorized", "سجّل الدخول أولاً.");
    let cached: Promise<Record<string, unknown>> | null = null;
    const ctx: Ctx = {
      req,
      params,
      query: new URL(req.url).searchParams,
      user,
      token,
      ip: clientIp(req),
      body: () => (cached ??= readJson(req)),
    };
    const result = await handler(ctx);
    if (req.method !== "GET") schedulePushDelivery();
    if (result instanceof Response) return result;
    if (result instanceof Ok) return json({ data: result.data ?? null, ...result.extra }, result.status);
    return json({ data: result ?? null });
  } catch (e) {
    if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
    if (e instanceof UserError) return json({ error: { code: "invalid", message: e.message } }, 400);
    console.error("[halali api]", req.method, new URL(req.url).pathname, e);
    return json({ error: { code: "server_error", message: "حدث خطأ غير متوقع، حاول مرة أخرى." } }, 500);
  }
}

// ---------- Helpers for handlers ----------

export const MAX_ID = 2_147_483_647;
export const intParam = (v: string | undefined | null, what = "المعرّف") => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > MAX_ID) throw new ApiError(400, "invalid", `${what} غير صحيح.`);
  return n;
};
export const pageParam = (q: URLSearchParams) => Math.max(1, Math.floor(Number(q.get("page")) || 1));
export const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
