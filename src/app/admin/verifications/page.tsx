import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationRequests } from "@/db/schema";
import { cityLabel, ROLE_LABELS, VERIFICATION_LABELS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { reviewVerificationAction } from "@/app/actions/admin";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

const DOCS: Record<string, string> = { national_id: "البطاقة الوطنية", passport: "جواز السفر", residence: "بطاقة السكن" };

export default async function Verifications({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const rows = await db
    .select({ r: verificationRequests, u: users })
    .from(verificationRequests)
    .innerJoin(users, eq(users.id, verificationRequests.userId))
    .where(all ? undefined : eq(verificationRequests.status, "pending"))
    .orderBy(desc(verificationRequests.createdAt))
    .limit(100);
  return (
    <div>
      <PageHeader title="طلبات التوثيق" actions={<a href={all ? "?" : "?all=1"} className="btn-outline">{all ? "المعلقة فقط" : "عرض الكل"}</a>} />
      {rows.length === 0 ? (
        <EmptyState icon="🪪" title="لا توجد طلبات بانتظار المراجعة" />
      ) : (
        <div className="space-y-4">
          {rows.map(({ r, u }) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.fullName} <span className="text-sm font-normal text-ink/55">(اسم الحساب: {u.name})</span></div>
                  <div className="text-sm text-ink/60">{ROLE_LABELS[u.role]} · {cityLabel(u.city)} · <span dir="ltr">{u.phone}</span> · {DOCS[r.documentType]}</div>
                  <div className="text-xs text-ink/45">{dateTime(r.createdAt)}</div>
                  {r.note && <p className="mt-1 text-sm">«{r.note}»</p>}
                </div>
                <Badge tone={r.status === "verified" ? "green" : r.status === "rejected" ? "red" : "amber"}>{VERIFICATION_LABELS[r.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {[...r.documentImages, ...(r.licenseImage ? [r.licenseImage] : [])].map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="block h-36 w-56 overflow-hidden rounded-xl border border-earth-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="مستمسك" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
              {r.status === "pending" ? (
                <form action={reviewVerificationAction} className="mt-4 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" className="input max-w-md flex-1" placeholder="سبب الرفض (يظهر للمستخدم)" />
                  <button name="decision" value="approve" className="btn-primary">✓ توثيق</button>
                  <button name="decision" value="reject" className="btn-danger">رفض</button>
                </form>
              ) : r.adminNote && <p className="mt-2 text-sm text-ink/60">ملاحظة: {r.adminNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
