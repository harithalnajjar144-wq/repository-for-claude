const nf = new Intl.NumberFormat("ar-IQ-u-nu-latn");

/** Format an IQD amount, e.g. "1,250,000 د.ع". */
export function iqd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "السعر عند الاتصال";
  return `${nf.format(amount)} د.ع`;
}

export function num(n: number | null | undefined) {
  return n === null || n === undefined ? "-" : nf.format(n);
}

const dtf = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Baghdad",
});
const df = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
  dateStyle: "medium",
  timeZone: "Asia/Baghdad",
});

export const dateTime = (d: Date | string | null | undefined) => (d ? dtf.format(new Date(d)) : "-");
export const dateOnly = (d: Date | string | null | undefined) => (d ? df.format(new Date(d)) : "-");

export function timeAgo(d: Date | string): string {
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

/** Normalise an Iraqi mobile number to 07XXXXXXXXX. Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  let p = input.replace(/[\s\-()]/g, "");
  // Arabic-Indic digits → Latin
  p = p.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (p.startsWith("+964")) p = "0" + p.slice(4);
  else if (p.startsWith("00964")) p = "0" + p.slice(5);
  else if (p.startsWith("964")) p = "0" + p.slice(3);
  else if (/^7\d{9}$/.test(p)) p = "0" + p;
  return /^07\d{9}$/.test(p) ? p : null;
}

/** wa.me link for an Iraqi number. */
export function whatsappLink(phone: string, text?: string) {
  const intl = "964" + phone.replace(/^0/, "");
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
