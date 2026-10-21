import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/constants";
import { dateOnly, iqd } from "@/lib/format";
import { subscribeAction } from "@/app/actions/account";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "الباقة والاشتراك" };

export default async function SubscriptionPage() {
  const user = await requireUser();
  const [available, sub, s] = await Promise.all([
    db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)),
    getActiveSubscription(user.id),
    getSettings(),
  ]);
  const mine = available.filter((p) => p.role === user.role || user.role === "admin");
  return (
    <div className="space-y-6">
      <PageHeader title="الباقة والاشتراك" subtitle={`باقات ${ROLE_LABELS[user.role]} - تُدفع شهرياً من المحفظة.`} />
      {sub ? (
        <Notice tone="green">باقتك الحالية: <b>{sub.plan.name}</b> حتى {dateOnly(sub.sub.endsAt)}. التجديد يضيف المدة إلى نهاية اشتراكك الحالي.</Notice>
      ) : (
        <Notice tone="earth">
          أنت على الحساب المجاني: {s.freeActiveListings} إعلانات نشطة{user.role === "trader" ? ` و ${s.freeActiveAuctions} مزاد نشط` : ""}.
        </Notice>
      )}
      {mine.length === 0 ? (
        <p className="text-sm text-ink/60">لا توجد باقات مدفوعة لنوع حسابك حالياً. الاستخدام مجاني.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {mine.map((p) => (
            <div key={p.id} className={`card flex flex-col p-5 ${sub?.plan.id === p.id ? "ring-2 ring-brand-500" : ""}`}>
              <h2 className="text-lg font-bold">{p.name}</h2>
              <div className="mt-2 text-2xl font-bold text-brand-700">{iqd(p.priceMonthly)}<span className="text-sm font-normal text-ink/50"> / شهر</span></div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                <li>✓ {p.maxActiveListings === null ? "إعلانات غير محدودة" : `${p.maxActiveListings} إعلان نشط`}</li>
                {p.role === "trader" && <li>✓ {p.maxActiveAuctions === null ? "مزادات غير محدودة" : `${p.maxActiveAuctions} مزاد نشط`}</li>}
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <ActionForm action={subscribeAction} className="mt-4">
                <input type="hidden" name="planId" value={p.id} />
                <div className="flex gap-2">
                  <select name="months" className="input w-28" defaultValue="1">
                    <option value="1">شهر</option><option value="3">3 أشهر</option><option value="6">6 أشهر</option><option value="12">سنة</option>
                  </select>
                  <SubmitButton className="btn-primary flex-1" pendingText="…" confirm={`سيتم خصم ${iqd(p.priceMonthly)} شهرياً من محفظتك. متابعة؟`}>
                    {sub?.plan.id === p.id ? "تجديد" : "اشترك"}
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
