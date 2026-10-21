import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { labelOf, REPORT_REASONS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { resolveReportAction } from "@/app/actions/admin";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

const LINK: Record<string, (id: number) => string> = {
  listing: (id) => `/listings/${id}`,
  auction: (id) => `/auctions/${id}`,
  user: (id) => `/u/${id}`,
  provider: (id) => `/p/${id}`,
};
const TYPE: Record<string, string> = { listing: "إعلان", auction: "مزاد", user: "مستخدم", provider: "عيادة/محل" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const rows = await db
    .select({ r: reports, reporter: users.name })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(all ? undefined : eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt))
    .limit(200);
  return (
    <div>
      <PageHeader title="البلاغات" actions={<a href={all ? "?" : "?all=1"} className="btn-outline">{all ? "المفتوحة فقط" : "عرض الكل"}</a>} />
      {rows.length === 0 ? (
        <EmptyState icon="✅" title="لا توجد بلاغات مفتوحة" />
      ) : (
        <div className="space-y-3">
          {rows.map(({ r, reporter }) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{labelOf(REPORT_REASONS, r.reason)}</div>
                  <div className="text-sm text-ink/60">
                    {TYPE[r.targetType]}: <Link className="text-brand-700 underline" href={(LINK[r.targetType] ?? LINK.listing)(r.targetId)}>#{r.targetId}</Link> · من {reporter} · {dateTime(r.createdAt)}
                  </div>
                  {r.details && <p className="mt-1 text-sm">«{r.details}»</p>}
                </div>
                <Badge tone={r.status === "open" ? "amber" : "gray"}>{r.status === "open" ? "مفتوح" : r.status === "resolved" ? "تم الحل" : "مرفوض"}</Badge>
              </div>
              {r.status === "open" && (
                <form action={resolveReportAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" className="input max-w-sm flex-1" placeholder="ملاحظة داخلية" />
                  <button name="status" value="resolved" className="btn-primary">تم الحل</button>
                  <button name="status" value="dismissed" className="btn-outline">رفض البلاغ</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
