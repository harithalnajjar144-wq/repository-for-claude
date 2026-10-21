import Link from "next/link";
import { whatsappLink } from "@/lib/format";
import { cityLabel, ROLE_LABELS } from "@/lib/constants";
import { dateOnly } from "@/lib/format";
import { VerifiedBadge } from "./ui";

export function ContactCard({
  seller,
  loggedIn,
  next,
  message,
}: {
  seller: { id: number; name: string; phone: string; whatsapp: string | null; city: string; role: string; verificationStatus: string; createdAt: Date };
  loggedIn: boolean;
  next: string;
  message: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{seller.name.slice(0, 1)}</div>
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {seller.name} <VerifiedBadge status={seller.verificationStatus} />
          </div>
          <div className="text-xs text-ink/55">
            {ROLE_LABELS[seller.role]} · {cityLabel(seller.city)} · عضو منذ {dateOnly(seller.createdAt)}
          </div>
        </div>
      </div>
      {seller.verificationStatus !== "verified" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          هذا الحساب غير موثق بعد. عاين الحيوان بنفسك ولا تحوّل أي مبلغ قبل الاستلام.
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {loggedIn ? (
          <>
            <a href={`tel:${seller.phone}`} className="btn-primary" dir="ltr">📞 {seller.phone}</a>
            <a href={whatsappLink(seller.whatsapp ?? seller.phone, message)} target="_blank" rel="noopener noreferrer" className="btn-outline">
              💬 مراسلة عبر واتساب
            </a>
          </>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary">سجّل الدخول لإظهار رقم البائع</Link>
        )}
        <Link href={`/u/${seller.id}`} className="btn-ghost text-sm">عرض كل إعلانات البائع</Link>
      </div>
    </div>
  );
}
