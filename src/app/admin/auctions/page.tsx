import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { auctions, users } from "@/db/schema";
import { settleDueAuctions } from "@/lib/auctions";
import { AUCTION_STATUS_LABELS } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import { adminAuctionAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export default async function AdminAuctions() {
  await settleDueAuctions();
  const winner = alias(users, "winner");
  const rows = await db
    .select({ a: auctions, seller: users.name, winner: winner.name, winnerPhone: winner.phone })
    .from(auctions)
    .innerJoin(users, eq(users.id, auctions.sellerId))
    .leftJoin(winner, eq(winner.id, auctions.winnerId))
    .orderBy(desc(auctions.createdAt))
    .limit(150);
  return (
    <div>
      <PageHeader title="المزادات" subtitle="المزادات المنتهية بانتظار التسليم يمكن إتمامها أو مصادرة تأمين الفائز إذا انسحب." />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>المزاد</th><th>البائع</th><th>الحالة</th><th>السعر</th><th>الفائز</th><th>إجراءات</th></tr></thead>
          <tbody>
            {rows.map(({ a, seller, winner, winnerPhone }) => (
              <tr key={a.id}>
                <td><Link href={`/auctions/${a.id}`} className="font-medium hover:text-brand-700">#{a.id} {a.title}</Link><div className="text-xs text-ink/50">ينتهي {dateTime(a.endsAt)}</div></td>
                <td>{seller}</td>
                <td className="whitespace-nowrap">{AUCTION_STATUS_LABELS[a.status]}</td>
                <td className="whitespace-nowrap">{iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}<div className="text-xs text-ink/50">{a.bidCount} مزايدة</div></td>
                <td>{winner ? <>{winner}<div className="text-xs" dir="ltr">{winnerPhone}</div></> : "-"}</td>
                <td>
                  <form action={adminAuctionAction} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    {a.status === "ended" && (
                      <>
                        <SubmitButton className="btn-ghost px-2 py-1 text-xs" confirm="تأكيد إتمام الصفقة وإرجاع تأمين الفائز؟"><span>إتمام</span></SubmitButton>
                        <input type="hidden" name="op" value="complete" />
                      </>
                    )}
                  </form>
                  {a.status === "ended" && (
                    <form action={adminAuctionAction} className="mt-1 flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="op" value="forfeit" />
                      <input name="note" className="input w-32 py-1 text-xs" placeholder="سبب المصادرة" />
                      <SubmitButton className="btn-ghost px-2 py-1 text-xs text-red-600" confirm="مصادرة تأمين الفائز وتعويض البائع وإلغاء المزاد؟">مصادرة</SubmitButton>
                    </form>
                  )}
                  {["scheduled", "live", "ended"].includes(a.status) && (
                    <form action={adminAuctionAction} className="mt-1">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="op" value="cancel" />
                      <SubmitButton className="btn-ghost px-2 py-1 text-xs text-red-600" confirm="إلغاء المزاد وإرجاع كل التأمينات؟">إلغاء</SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
