/**
 * Input schemas shared by the web server actions and the mobile JSON API.
 * They accept both form values (strings, "on" checkboxes) and JSON (numbers, booleans).
 */
import { z } from "zod";
import { ANIMAL_CATEGORIES, GOVERNORATES, PRODUCT_CATEGORIES, REPORT_REASONS, TOPUP_METHODS } from "./constants";
import { UserError } from "./errors";

const keys = <T extends readonly { key: string }[]>(list: T) => list.map((x) => x.key) as [string, ...string[]];

/** Optional non-negative integer; "" / null / undefined → undefined; "1,000" → 1000. */
export const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/[,\s]/g, ""))),
  z.number().int().min(0).optional(),
);
/** Checkbox / JSON boolean. */
export const bool = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());
const optText = (max: number) =>
  z.preprocess((v) => (v === null || v === undefined ? undefined : String(v)), z.string().trim().max(max).optional());

export const city = z.enum(keys(GOVERNORATES), { message: "اختر المحافظة" });
export const animalCategory = z.enum(keys(ANIMAL_CATEGORIES), { message: "اختر نوع الحيوان" });
export const gender = z.enum(["male", "female", "mixed", "unknown"]).default("unknown");

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserError(r.error.issues[0].message);
  return r.data;
}

/** Turn FormData into a plain object (last value wins; use getAll for repeated fields). */
export const formObject = (fd: FormData) => Object.fromEntries(fd);

// ---------- Auth & account ----------

export const registerInput = z.object({
  name: z.string().trim().min(3, "الاسم قصير جداً").max(120),
  phone: z.string().trim().min(1, "أدخل رقم الهاتف"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(100),
  city,
  role: z.enum(["user", "trader", "vet", "shop"]).default("user"),
  businessName: optText(160),
  otpToken: optText(200),
});

export const profileInput = z.object({
  name: z.string().trim().min(3, "الاسم قصير جداً").max(120),
  city,
  whatsapp: optText(20),
  email: z.union([z.literal(""), z.email("البريد الإلكتروني غير صحيح")]).optional(),
  bio: optText(1000),
});

export const verificationInput = z.object({
  fullName: z.string().trim().min(6, "أدخل الاسم الرباعي كما في المستمسك.").max(160),
  documentType: z.enum(["national_id", "passport", "residence"], { message: "اختر نوع المستمسك." }),
  documentImages: z.array(z.string()).max(2).default([]),
  licenseImage: optText(300),
  note: optText(1000),
});

export const topupInput = z.object({
  amount: z.preprocess((v) => Math.floor(Number(v)), z.number().min(5000, "أقل مبلغ للشحن 5,000 د.ع.").max(100_000_000, "المبلغ كبير جداً. تواصل مع الدعم.")),
  method: z.enum(keys(TOPUP_METHODS), { message: "اختر طريقة الدفع." }),
  transferRef: optText(120),
  receiptImage: optText(300),
});

// ---------- Listings ----------

export const listingInput = z.object({
  type: z.enum(["offer", "wanted"]).default("offer"),
  category: animalCategory,
  breed: optText(80),
  title: z.string().trim().min(5, "العنوان قصير جداً").max(160),
  description: z.string().trim().min(10, "أضف وصفاً أوضح (10 أحرف على الأقل)").max(5000),
  price: optInt,
  negotiable: bool,
  quantity: z.preprocess((v) => Number(v || 1), z.number().int().min(1, "العدد غير صحيح").max(100000)),
  ageMonths: optInt,
  gender,
  weightKg: optInt,
  city,
  area: optText(80),
});
export type ListingInput = z.infer<typeof listingInput>;

export const listingStatus = z.enum(["active", "sold", "hidden", "removed"]);

export const reportInput = z.object({
  targetType: z.enum(["listing", "auction", "user", "provider"], { message: "بلاغ غير صالح." }),
  targetId: z.preprocess((v) => Number(v), z.number().int().positive("بلاغ غير صالح.")),
  reason: z.enum(keys(REPORT_REASONS), { message: "اختر سبب البلاغ." }),
  details: optText(2000),
});

// ---------- Auctions ----------

export const auctionInput = z.object({
  title: z.string().trim().min(5, "العنوان قصير جداً").max(160),
  description: z.string().trim().min(10, "أضف وصفاً أوضح").max(5000),
  category: animalCategory,
  breed: optText(80),
  ageMonths: optInt,
  gender,
  weightKg: optInt,
  quantity: z.preprocess((v) => Number(v || 1), z.number().int().min(1).max(10000)),
  city,
  startPrice: z.preprocess((v) => Number(String(v ?? "").replace(/[,\s]/g, "")), z.number().int("سعر البداية غير صحيح").min(10000, "أقل سعر بداية 10,000 د.ع")),
  minIncrement: optInt,
  reservePrice: optInt,
  depositAmount: optInt,
  startMode: z.enum(["now", "scheduled"]).default("now"),
  /** Web: "YYYY-MM-DDTHH:mm" in Baghdad time. API: full ISO timestamp. */
  startsAt: optText(40),
  durationHours: z.preprocess((v) => Number(v), z.number().int().min(1).max(24 * 14)),
});
export type AuctionInput = z.infer<typeof auctionInput>;

// ---------- Vets & shops ----------

export const providerInput = z.object({
  businessName: z.string().trim().min(3, "الاسم قصير جداً").max(160),
  description: optText(3000),
  city,
  address: optText(300),
  phone: optText(20),
  whatsapp: optText(20),
  workingHours: optText(200),
  /** Comma/newline separated string (web) or array (API). */
  specialties: z.preprocess(
    (v) =>
      (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,،\n]/))
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12),
    z.array(z.string().max(60)),
  ),
  homeVisits: bool,
  delivery: bool,
  isActive: bool,
});

export const serviceInput = z.object({
  id: optInt,
  name: z.string().trim().min(2, "أدخل اسم الخدمة").max(120),
  description: optText(1000),
  price: optInt,
  durationMinutes: z.preprocess((v) => Number(v || 30), z.number().int().min(5).max(600)),
});

export const productInput = z.object({
  id: optInt,
  name: z.string().trim().min(2, "أدخل اسم المنتج").max(160),
  category: z.enum(keys(PRODUCT_CATEGORIES)),
  description: optText(2000),
  price: z.preprocess((v) => Number(v), z.number().int().min(0, "السعر غير صحيح")),
  unit: optText(30),
  stock: z.preprocess((v) => Number(v || 0), z.number().int().min(0)),
});

export const bookingInput = z.object({
  providerId: z.preprocess((v) => Number(v), z.number().int().positive()),
  serviceId: optInt,
  /** ISO timestamp (API) — or date + time in Baghdad time (web). */
  scheduledAt: optText(40),
  date: optText(10),
  time: optText(5),
  animalType: z.string().trim().min(1, "حدد نوع الحيوان.").max(60),
  animalCount: z.preprocess((v) => Math.max(1, Number(v) || 1), z.number().int().max(100000)),
  homeVisit: bool,
  notes: optText(2000),
});

export const orderInput = z.object({
  providerId: z.preprocess((v) => Number(v), z.number().int().positive()),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(1000) }))
    .min(1, "اختر كمية لمنتج واحد على الأقل."),
  fulfilment: z.enum(["pickup", "delivery"]).default("pickup"),
  address: optText(300),
  phone: optText(20),
  notes: optText(1000),
});
