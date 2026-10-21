import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auctions, listings, users } from "@/db/schema";
import { cityLabel, ROLE_LABELS } from "@/lib/constants";
import { dateOnly } from "@/lib/format";
import { AuctionCard, ListingCard } from "@/components/cards";
import { EmptyState, VerifiedBadge } from "@/components/ui";

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || u.isBanned) notFound();
  const seller = { name: u.name, verificationStatus: u.verificationStatus };
  const [ls, as] = await Promise.all([
    db.select().from(listings).where(and(eq(listings.userId, id), eq(listings.status, "active"))).orderBy(desc(listings.createdAt)).limit(48),
    db.select().from(auctions).where(and(eq(auctions.sellerId, id), inArray(auctions.status, ["scheduled", "live"]))).limit(12),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="card mb-8 flex flex-wrap items-center gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{u.name.slice(0, 1)}</div>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">{u.name} <VerifiedBadge status={u.verificationStatus} /></h1>
          <div className="text-sm text-ink/60">{ROLE_LABELS[u.role]} · {cityLabel(u.city)} · عضو منذ {dateOnly(u.createdAt)}</div>
          {u.bio && <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/75">{u.bio}</p>}
        </div>
      </div>
      {as.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold">مزادات نشطة</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{as.map((a) => <AuctionCard key={a.id} a={{ ...a, seller }} />)}</div>
        </section>
      )}
      <h2 className="mb-4 text-xl font-bold">الإعلانات ({ls.length})</h2>
      {ls.length === 0 ? <EmptyState title="لا توجد إعلانات نشطة" /> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{ls.map((l) => <ListingCard key={l.id} l={{ ...l, seller }} />)}</div>
      )}
    </div>
  );
}
