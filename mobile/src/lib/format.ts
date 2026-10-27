/** Money and date formatting. Dates are shown in Baghdad time (UTC+3, no daylight saving). */

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const iqd = (n: number | null | undefined) => (n === null || n === undefined ? "السعر عند الاتصال" : `${group(n)} د.ع`);
export const num = (n: number | null | undefined) => (n === null || n === undefined ? "-" : group(n));

const MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Date parts in Baghdad time. */
export function baghdad(d: Date | string) {
  const t = new Date(new Date(d).getTime() + 3 * 3600_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), wd: t.getUTCDay() };
}

export function timeOf(d: Date | string) {
  const p = baghdad(d);
  const h12 = p.h % 12 || 12;
  return `${h12}:${String(p.min).padStart(2, "0")} ${p.h < 12 ? "ص" : "م"}`;
}

export const dateOnly = (d: Date | string | null | undefined) => {
  if (!d) return "-";
  const p = baghdad(d);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
};

export const dateTime = (d: Date | string | null | undefined) => (d ? `${dateOnly(d)}، ${timeOf(d)}` : "-");

export const dayLabel = (d: Date | string) => {
  const p = baghdad(d);
  return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m]}`;
};

export function timeAgo(d: Date | string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const days = Math.floor(h / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return dateOnly(d);
}

export function ageLabel(months: number | null | undefined) {
  if (!months) return null;
  if (months < 12) return `${months} شهر`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} سنة و ${m} شهر` : `${y} سنة`;
}

/** Digits only (accepts Arabic-Indic digits and commas). */
export const toInt = (s: string) => {
  const latin = s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[^\d]/g, "");
  return latin ? Number(latin) : null;
};

export const whatsappUrl = (phone: string, text?: string) =>
  `https://wa.me/964${phone.replace(/^0/, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
