import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, providers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import { updateOrderAction } from "@/app/actions/providers";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export default async function MyOrders() {
  const user = await requireUser();
  const rows = await db
    .select({ o: orders, p: providers })
    .from(orders)
    .innerJoin(providers, eq(providers.id, orders.providerId))
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));
  const items = rows.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.o.id))) : [];
  return (
    <div>
      <PageHeader title="طلباتي من المحلات" actions={<Link href="/shops" className="btn-primary">تسوّق</Link>} />
      {rows.length === 0 ? (
        <EmptyState icon="🛒" title="لا توجد طلبات" />
      ) : (
        <div className="space-y-3">
          {rows.map(({ o, p }) => (
            <div key={o.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/shops/${p.id}`} className="font-semibold hover:text-brand-700">{p.businessName}</Link>
                  <span className="text-xs text-ink/50"> · طلب #{o.id} · {dateTime(o.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "gray" : "amber"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  {o.status === "pending" && (
                    <form action={updateOrderAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <button name="status" value="cancelled" className="btn-ghost text-xs text-red-600">إلغاء</button>
                    </form>
                  )}
                </div>
              </div>
              <ul className="mt-2 text-sm text-ink/70">
                {items.filter((i) => i.orderId === o.id).map((i) => (
                  <li key={i.id}>{i.quantity} × {i.name} — {iqd(i.unitPrice * i.quantity)}</li>
                ))}
              </ul>
              <div className="mt-2 text-sm font-semibold">المجموع: {iqd(o.total)} · {o.fulfilment === "delivery" ? "توصيل" : "استلام من المحل"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
