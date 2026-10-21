import type { Provider } from "@/db/schema";
import { cityLabel } from "@/lib/constants";
import { whatsappLink } from "@/lib/format";
import { Badge, VerifiedBadge } from "./ui";

export function ProviderHeader({ p, verification, loggedIn }: { p: Provider; verification: string; loggedIn: boolean }) {
  const phone = p.phone;
  return (
    <div className="card overflow-hidden">
      <div className="h-28 bg-gradient-to-l from-brand-700 via-brand-600 to-earth-400" />
      <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
        <div className="-mt-10 h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-brand-50 shadow">
          {p.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">{p.kind === "vet" ? "🩺" : "🏪"}</div>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {p.businessName} <VerifiedBadge status={verification} />
          </h1>
          <div className="mt-1 text-sm text-ink/60">📍 {cityLabel(p.city)}{p.address ? ` - ${p.address}` : ""}</div>
          {p.workingHours && <div className="mt-0.5 text-sm text-ink/60">🕒 {p.workingHours}</div>}
          <div className="mt-2 flex flex-wrap gap-1">
            {p.homeVisits && <Badge tone="green">زيارات منزلية</Badge>}
            {p.delivery && <Badge tone="green">توصيل</Badge>}
            {p.specialties.map((s) => <Badge key={s} tone="earth">{s}</Badge>)}
          </div>
        </div>
        {phone && loggedIn && (
          <div className="flex gap-2">
            <a href={`tel:${phone}`} className="btn-primary" dir="ltr">📞 {phone}</a>
            <a href={whatsappLink(p.whatsapp ?? phone, `السلام عليكم، وصلت إليكم عن طريق منصة حلالي`)} target="_blank" rel="noopener noreferrer" className="btn-outline">واتساب</a>
          </div>
        )}
      </div>
      {p.description && <p className="whitespace-pre-line border-t border-earth-50 px-6 py-4 leading-8 text-ink/75">{p.description}</p>}
    </div>
  );
}
