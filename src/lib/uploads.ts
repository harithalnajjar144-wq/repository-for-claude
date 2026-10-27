/**
 * Image storage. Files are stored either on local disk (UPLOAD_DIR, default)
 * or in an S3-compatible bucket such as Cloudflare R2 (when S3_BUCKET is set).
 *
 * Private files (ID documents, receipts) go to S3_PRIVATE_BUCKET, which must never be public.
 *
 * URLs saved in the database never change between backends:
 *   /api/files/<name>          public images (listings, auctions, logos, ads)
 *   /api/private-files/<name>  ID documents and payment receipts (admins only)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { UserError } from "./errors";

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
export const PRIVATE_DIR = path.join(UPLOAD_DIR, "private");
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const NAME_RE = /^[a-z0-9-]+\.(jpg|png|webp)$/;
export const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

// ---------- Backends ----------

type Backend = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
};

/** Uploads per user per 24 hours (stops a single account from filling the disk). */
const DAILY_UPLOAD_LIMIT = 300;

const disk: Backend = {
  async put(key, body) {
    const file = path.join(UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  },
  async get(key) {
    try {
      return await readFile(path.join(UPLOAD_DIR, key));
    } catch {
      return null;
    }
  },
};

let s3Backend: Promise<Backend> | null = null;
function s3(): Promise<Backend> {
  s3Backend ??= (async () => {
    const { S3Client, PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT, // e.g. https://<account>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: !!process.env.S3_ENDPOINT,
    });
    const publicBucket = process.env.S3_BUCKET!;
    const privateBucket = process.env.S3_PRIVATE_BUCKET;
    // Private files must never land in a bucket that is served publicly.
    const bucketFor = (key: string) => {
      if (!key.startsWith("private/")) return publicBucket;
      if (privateBucket) return privateBucket;
      if (process.env.S3_PUBLIC_URL) throw new Error("S3_PRIVATE_BUCKET is required when S3_PUBLIC_URL is set.");
      return publicBucket;
    };
    return {
      async put(key, body, contentType) {
        await client.send(new PutObjectCommand({ Bucket: bucketFor(key), Key: key, Body: body, ContentType: contentType }));
      },
      async get(key) {
        try {
          const r = await client.send(new GetObjectCommand({ Bucket: bucketFor(key), Key: key }));
          return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
        } catch {
          return null;
        }
      },
    };
  })();
  return s3Backend;
}

const backend = (): Promise<Backend> => (process.env.S3_BUCKET ? s3() : Promise.resolve(disk));
const keyFor = (name: string, isPrivate: boolean) => (isPrivate ? `private/${name}` : name);

/** Public CDN base for public images (e.g. an R2 public bucket domain). Optional. */
export const publicBaseUrl = () => process.env.S3_PUBLIC_URL?.replace(/\/$/, "") || null;

// ---------- Saving ----------

type StoreOpts = { private?: boolean; userId?: number | null };

/** Throws if the user already uploaded too many files today. */
export async function assertUploadQuota(userId: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(uploads)
    .where(and(eq(uploads.userId, userId), gt(uploads.createdAt, new Date(Date.now() - 86400_000))));
  if (n >= DAILY_UPLOAD_LIMIT) throw new UserError("تجاوزت الحد اليومي لرفع الصور. حاول غداً.");
}

/** Validate and store raw image bytes. Returns the stable URL. The uploader is recorded. */
export async function storeImage(buf: Buffer, opts: StoreOpts = {}): Promise<string> {
  if (buf.length === 0) throw new UserError("الملف فارغ.");
  if (buf.length > MAX_IMAGE_BYTES) throw new UserError("حجم الصورة يجب أن يكون أقل من 6 ميغابايت.");
  const ext = sniff(buf);
  if (!ext) throw new UserError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP.");
  if (opts.userId) await assertUploadQuota(opts.userId);
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
  await (await backend()).put(keyFor(name, !!opts.private), buf, CONTENT_TYPES[ext]);
  await db.insert(uploads).values({ name, userId: opts.userId ?? null, isPrivate: !!opts.private, size: buf.length });
  return opts.private ? `/api/private-files/${name}` : `/api/files/${name}`;
}

const isFile = (f: FormDataEntryValue | null): f is File => !!f && typeof f === "object" && "arrayBuffer" in f && f.size > 0;

/** Save uploaded images from a FormData field (web forms). */
export async function saveImages(files: FormDataEntryValue[], max = 8, opts: StoreOpts = {}): Promise<string[]> {
  const real = files.filter(isFile);
  if (real.length > max) throw new UserError(`الحد الأقصى ${max} صور.`);
  const urls: string[] = [];
  for (const f of real) {
    if (f.size > MAX_IMAGE_BYTES) throw new UserError("حجم الصورة يجب أن يكون أقل من 6 ميغابايت.");
    urls.push(await storeImage(Buffer.from(await f.arrayBuffer()), opts));
  }
  return urls;
}

export async function saveImage(file: FormDataEntryValue | null, opts: StoreOpts = {}): Promise<string | null> {
  if (!isFile(file)) return null;
  const [url] = await saveImages([file], 1, opts);
  return url ?? null;
}

// ---------- Reading & validation ----------

function parseUrl(url: string): { name: string; isPrivate: boolean } | null {
  const m = /^\/api\/(private-)?files\/([^/?#]+)$/.exec(url);
  if (!m || !NAME_RE.test(m[2])) return null;
  return { name: m[2], isPrivate: !!m[1] };
}

export async function readStoredFile(name: string, isPrivate: boolean): Promise<Buffer | null> {
  if (!NAME_RE.test(name)) return null;
  return (await backend()).get(keyFor(name, isPrivate));
}

/**
 * Check image URLs sent by clients before attaching them to a record.
 * Each must be a file this user uploaded, with the expected visibility.
 */
export async function assertUploadedImages(
  urls: string[],
  opts: { private?: boolean; max: number; userId: number },
): Promise<string[]> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length > opts.max) throw new UserError(`الحد الأقصى ${opts.max} صور.`);
  if (!unique.length) return [];
  const parsed = unique.map(parseUrl);
  if (parsed.some((p) => !p || p.isPrivate !== !!opts.private)) throw new UserError("صورة غير صالحة. أعد رفع الصورة.");
  const rows = await db
    .select()
    .from(uploads)
    .where(inArray(uploads.name, parsed.map((p) => p!.name)));
  for (const p of parsed) {
    const row = rows.find((r) => r.name === p!.name);
    if (!row || row.isPrivate !== !!opts.private || row.userId !== opts.userId) throw new UserError("صورة غير صالحة. أعد رفع الصورة.");
  }
  return unique;
}

export const fileNameRe = NAME_RE;
