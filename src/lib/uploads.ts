import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { UserError } from "./errors";

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
const MAX_BYTES = 6 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/** Save uploaded images (from a FormData field) and return their public URLs. */
export const PRIVATE_DIR = path.join(UPLOAD_DIR, "private");

/**
 * Save uploaded images (from a FormData field) and return their URLs.
 * Private files (ID documents) are only served to admins.
 */
export async function saveImages(files: FormDataEntryValue[], max = 8, opts: { private?: boolean } = {}): Promise<string[]> {
  const real = files.filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);
  if (real.length > max) throw new UserError(`الحد الأقصى ${max} صور.`);
  const dir = opts.private ? PRIVATE_DIR : UPLOAD_DIR;
  await mkdir(dir, { recursive: true });
  const urls: string[] = [];
  for (const f of real) {
    if (f.size > MAX_BYTES) throw new UserError("حجم الصورة يجب أن يكون أقل من 6 ميغابايت.");
    const buf = Buffer.from(await f.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) throw new UserError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP.");
    const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    urls.push(opts.private ? `/api/private-files/${name}` : `/api/files/${name}`);
  }
  return urls;
}

export async function saveImage(file: FormDataEntryValue | null, opts: { private?: boolean } = {}): Promise<string | null> {
  if (!file) return null;
  const [url] = await saveImages([file], 1, opts);
  return url ?? null;
}
