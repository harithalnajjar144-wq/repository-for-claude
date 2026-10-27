import { Platform } from "react-native";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type Query = Record<string, string | number | boolean | undefined | null>;

export type ApiResult<T> = { data: T; page?: number; totalPages?: number; total?: number; message?: string };

function buildUrl(path: string, query?: Query) {
  const qs = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${API_URL}/api/v1${path}${qs ? `?${qs}` : ""}`;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  let body: { data?: T; error?: { code: string; message: string } } & Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, "bad_response", "استجابة غير متوقعة من الخادم.");
  }
  if (!res.ok || body.error) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? "حدث خطأ غير متوقع.");
  }
  return body as ApiResult<T>;
}

/** Call the API; returns the whole envelope ({ data, page, ... }). */
export async function apiRaw<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Query; form?: FormData } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  } catch {
    throw new ApiError(0, "network", "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.");
  }
  return parse<T>(res);
}

/** Call the API and return only `data`. */
export async function api<T>(path: string, opts?: Parameters<typeof apiRaw>[1]): Promise<T> {
  return (await apiRaw<T>(path, opts)).data;
}

/** Turn a stored image path (/api/files/...) into a full URL. */
export const fileUrl = (u?: string | null) => (!u ? undefined : u.startsWith("/") ? API_URL + u : u);

/** Upload one picked image; returns its stored URL. */
export async function uploadImage(uri: string, opts: { private?: boolean; mimeType?: string | null; fileName?: string | null } = {}) {
  const form = new FormData();
  const type = opts.mimeType ?? "image/jpeg";
  const name = opts.fileName ?? `photo.${type.split("/")[1] ?? "jpg"}`;
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    // React Native's FormData accepts a { uri, name, type } file descriptor.
    form.append("file", { uri, name, type } as unknown as Blob);
  }
  const r = await apiRaw<{ url: string }>("/uploads", { method: "POST", form, query: opts.private ? { private: 1 } : undefined });
  return r.data.url;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
