import Link from "next/link";
import { categoryIcon, categoryLabel, cityLabel, AUCTION_STATUS_LABELS } from "@/lib/constants";
import { ageLabel, iqd, timeAgo } from "@/lib/format";
import { liveStatus, minNextBid } from "@/lib/auctions";
import type { Auction, Listing, Provider } from "@/db/schema";
import { Badge, VerifiedBadge } from "./ui";
import { Countdown } from "./Countdown";

export function Thumb({ src, category, className = "" }: { src?: string; category: string; className?: string }) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
    );
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-earth-100 via-earth-50 to-brand-50 text-6xl ${className}`}>
      <span aria-hidden>{categoryIcon(category)}</span>
    </div>
  );
}

type ListingWithSeller = Listing & { seller: { name: string; verificationStatus: string } };

export function ListingCard({ l }: { l: ListingWithSeller }) {
  const featured = l.featuredUntil && new Date(l.featuredUntil) > new Date();
  return (
    <Link href={`/listings/${l.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Thumb src={l.images[0]} category={l.category} className="transition duration-300 group-hover:scale-105" />
        <div className="absolute start-2 top-2 flex gap-1">
          {l.type === "wanted" && <Badge tone="blue">مطلوب</Badge>}
          {featured && <Badge tone="amber">★ مميز</Badge>}
        </div>
        {l.images.length > 1 && (
          <span className="absolute bottom-2 end-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">{l.images.length} صور</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1 flex items-center gap-2 text-xs text-ink/55">
          <span>{categoryIcon(l.category)} {categoryLabel(l.category)}</span>
          {l.breed && <span>· {l.breed}</span>}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-snug text-ink group-hover:text-brand-700">{l.title}</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink/55">
          {l.quantity > 1 && <span>العدد: {l.quantity}</span>}
          {ageLabel(l.ageMonths) && <span>العمر: {ageLabel(l.ageMonths)}</span>}
          {l.weightKg && <span>{l.weightKg} كغم</span>}
        </div>
        <div className="mt-auto pt-3">
          <div className="text-lg font-bold text-brand-700">{iqd(l.price)}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-ink/50">
            <span>📍 {cityLabel(l.city)}</span>
            <span>{timeAgo(l.createdAt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-earth-50 pt-2 text-xs text-ink/65">
            <span className="truncate">{l.seller.name}</span>
            <VerifiedBadge status={l.seller.verificationStatus} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AuctionStatusBadge({ a }: { a: Pick<Auction, "status" | "startsAt" | "endsAt"> }) {
  const st = liveStatus(a);
  if (st === "live")
    return (
      <Badge tone="red">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" /> مباشر
      </Badge>
    );
  if (st === "scheduled") return <Badge tone="blue">يبدأ قريباً</Badge>;
  if (st === "closing") return <Badge tone="gray">يُغلق الآن</Badge>;
  return <Badge tone={st === "completed" || st === "ended" ? "green" : "gray"}>{AUCTION_STATUS_LABELS[st]}</Badge>;
}

export function AuctionCard({ a }: { a: Auction & { seller: { name: string; verificationStatus: string } } }) {
  const st = liveStatus(a);
  return (
    <Link href={`/auctions/${a.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Thumb src={a.images[0]} category={a.category} className="transition duration-300 group-hover:scale-105" />
        <div className="absolute start-2 top-2">
          <AuctionStatusBadge a={a} />
        </div>
        {(st === "live" || st === "scheduled") && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-sm text-white">
            {st === "live" ? "ينتهي خلال " : "يبدأ خلال "}
            <Countdown compact to={(st === "live" ? a.endsAt : a.startsAt).toISOString()} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1 text-xs text-ink/55">
          {categoryIcon(a.category)} {categoryLabel(a.category)} {a.breed && `· ${a.breed}`}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand-700">{a.title}</h3>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-xs">
          <div className="rounded-lg bg-earth-50 p-2">
            <div className="text-ink/50">{a.currentPrice ? "أعلى مزايدة" : "سعر البداية"}</div>
            <div className="text-sm font-bold text-earth-700">{iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}</div>
          </div>
          <div className="rounded-lg bg-brand-50 p-2">
            <div className="text-ink/50">{st === "live" ? "المزايدة التالية" : "التأمين"}</div>
            <div className="text-sm font-bold text-brand-700">{iqd(st === "live" ? minNextBid(a) : a.depositAmount)}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink/50">
          <span>📍 {cityLabel(a.city)}</span>
          <span>{a.bidCount} مزايدة</span>
        </div>
      </div>
    </Link>
  );
}

export function ProviderCard({ p, verified }: { p: Provider; verified?: string }) {
  const href = p.kind === "vet" ? `/vets/${p.id}` : `/shops/${p.id}`;
  return (
    <Link href={href} className="card group flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
        {p.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">{p.kind === "vet" ? "🩺" : "🏪"}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold group-hover:text-brand-700">{p.businessName}</h3>
          {verified && <VerifiedBadge status={verified} />}
        </div>
        <div className="mt-0.5 text-xs text-ink/55">📍 {cityLabel(p.city)}{p.address ? ` · ${p.address}` : ""}</div>
        {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-ink/70">{p.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          {p.homeVisits && <Badge tone="green">زيارات منزلية</Badge>}
          {p.delivery && <Badge tone="green">توصيل</Badge>}
          {p.specialties.slice(0, 3).map((s) => (
            <Badge key={s} tone="earth">{s}</Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
