import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auctionDeposits, auctions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { settleDueAuctions } from "@/lib/auctions";
import { AUCTION_STATUS_LABELS } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

const DEP: Record<string, string> = { held: "محجوز", released: "مُعاد", forfeited: "مُصادر" };

export default async function MyAuctions() {
  const user = await requireUser();
  await settleDueAuctions();
  const [mine, joined] = await Promise.all([
    db.select().from(auctions).where(eq(auctions.sellerId, user.id)).orderBy(desc(auctions.createdAt)),
    db
      .select({ a: auctions, d: auctionDeposits })
      .from(auctionDeposits)
      .innerJoin(auctions, eq(auctions.id, auctionDeposits.auctionId))
      .where(eq(auctionDeposits.userId, user.id))
      .orderBy(desc(auctionDeposits.createdAt)),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader title="المزادات" actions={(user.role === "trader" || user.role === "admin") && <Link href="/auctions/new" className="btn-earth">+ مزاد جديد</Link>} />
      <section>
        <h2 className="mb-3 font-semibold">مزايداتي</h2>
        {joined.length === 0 ? (
          <EmptyState icon="🔨" title="لم تشارك في أي مزاد بعد"><Link href="/auctions" className="font-semibold text-brand-700">تصفح المزادات المباشرة</Link></EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>المزاد</th><th>الحالة</th><th>السعر الحالي/النهائي</th><th>نتيجتي</th><th>التأمين</th></tr></thead>
              <tbody>
                {joined.map(({ a, d }) => (
                  <tr key={a.id}>
                    <td><Link href={`/auctions/${a.id}`} className="font-medium hover:text-brand-700">{a.title}</Link><div className="text-xs text-ink/50">ينتهي {dateTime(a.endsAt)}</div></td>
                    <td>{AUCTION_STATUS_LABELS[a.status]}</td>
                    <td>{iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}</td>
                    <td>{a.winnerId === user.id ? <Badge tone="green">🏆 فائز</Badge> : a.winnerId ? <Badge tone="gray">لم تفز</Badge> : "-"}</td>
                    <td>{iqd(d.amount)} <span className="text-xs text-ink/50">({DEP[d.status]})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {(user.role === "trader" || user.role === "admin" || mine.length > 0) && (
        <section>
          <h2 className="mb-3 font-semibold">مزاداتي كبائع</h2>
          {mine.length === 0 ? (
            <EmptyState icon="🐎" title="لم تفتح أي مزاد بعد" />
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>المزاد</th><th>الحالة</th><th>المزايدات</th><th>السعر</th><th>العمولة</th></tr></thead>
                <tbody>
                  {mine.map((a) => (
                    <tr key={a.id}>
                      <td><Link href={`/auctions/${a.id}`} className="font-medium hover:text-brand-700">{a.title}</Link><div className="text-xs text-ink/50">{dateTime(a.startsAt)} ← {dateTime(a.endsAt)}</div></td>
                      <td>{AUCTION_STATUS_LABELS[a.status]}{a.status === "ended" && <div className="text-xs text-earth-600">أكّد التسليم من صفحة المزاد</div>}</td>
                      <td>{a.bidCount}</td>
                      <td>{iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}</td>
                      <td>{a.commissionAmount ? iqd(a.commissionAmount) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
