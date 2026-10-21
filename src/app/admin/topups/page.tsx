import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { topupRequests, users } from "@/db/schema";
import { labelOf, TOPUP_METHODS } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import { reviewTopupAction } from "@/app/actions/admin";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export default async function Topups({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const rows = await db
    .select({ t: topupRequests, u: users })
    .from(topupRequests)
    .innerJoin(users, eq(users.id, topupRequests.userId))
    .where(all ? undefined : eq(topupRequests.status, "pending"))
    .orderBy(desc(topupRequests.createdAt))
    .limit(200);
  return (
    <div>
      <PageHeader title="طلبات شحن المحفظة" subtitle="تحقق من وصول المبلغ في حساب زين كاش / البنك قبل الموافقة." actions={<a href={all ? "?" : "?all=1"} className="btn-outline">{all ? "المعلقة فقط" : "عرض الكل"}</a>} />
      {rows.length === 0 ? (
        <EmptyState icon="💳" title="لا توجد طلبات شحن معلقة" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>المستخدم</th><th>المبلغ</th><th>الطريقة / المرجع</th><th>الإيصال</th><th>التاريخ</th><th>الإجراء</th></tr></thead>
            <tbody>
              {rows.map(({ t, u }) => (
                <tr key={t.id}>
                  <td>{u.name}<div className="text-xs text-ink/50" dir="ltr">{u.phone}</div></td>
                  <td className="whitespace-nowrap font-semibold">{iqd(t.amount)}</td>
                  <td>{labelOf(TOPUP_METHODS, t.method)}<div className="text-xs" dir="ltr">{t.transferRef}</div></td>
                  <td>{t.receiptImage ? <a href={t.receiptImage} target="_blank" rel="noreferrer" className="text-brand-700 underline">عرض</a> : "-"}</td>
                  <td className="whitespace-nowrap text-xs">{dateTime(t.createdAt)}</td>
                  <td>
                    {t.status === "pending" ? (
                      <form action={reviewTopupAction} className="flex gap-1">
                        <input type="hidden" name="id" value={t.id} />
                        <input name="note" className="input w-36 py-1 text-xs" placeholder="ملاحظة" />
                        <button name="decision" value="approve" className="btn-primary px-3 py-1 text-xs">قبول</button>
                        <button name="decision" value="reject" className="btn-outline px-3 py-1 text-xs text-red-600">رفض</button>
                      </form>
                    ) : (
                      <Badge tone={t.status === "approved" ? "green" : "red"}>{t.status === "approved" ? "مقبول" : "مرفوض"}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
