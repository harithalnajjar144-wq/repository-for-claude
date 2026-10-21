import { and, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { auctionDeposits, topupRequests, walletTransactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { labelOf, TOPUP_METHODS, TX_TYPE_LABELS } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import { requestTopupAction } from "@/app/actions/account";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "المحفظة" };

export default async function WalletPage() {
  const user = await requireUser();
  const s = await getSettings();
  const [txs, topups, [held]] = await Promise.all([
    db.select().from(walletTransactions).where(eq(walletTransactions.userId, user.id)).orderBy(desc(walletTransactions.id)).limit(100),
    db.select().from(topupRequests).where(eq(topupRequests.userId, user.id)).orderBy(desc(topupRequests.createdAt)).limit(10),
    db.select({ total: sum(auctionDeposits.amount) }).from(auctionDeposits).where(and(eq(auctionDeposits.userId, user.id), eq(auctionDeposits.status, "held"))),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="المحفظة" subtitle="تُستخدم المحفظة لتأمينات المزادات، الاشتراكات، تمييز الإعلانات، وعمولات المزاد." />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="الرصيد المتاح" value={<span className={user.walletBalance < 0 ? "text-red-600" : "text-brand-700"}>{iqd(user.walletBalance)}</span>} />
        <Stat label="تأمينات محجوزة في مزادات" value={iqd(Number(held.total ?? 0))} hint="تُعاد تلقائياً بعد انتهاء المزاد" />
        <Stat label="طلبات شحن قيد المراجعة" value={topups.filter((t) => t.status === "pending").length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionForm action={requestTopupAction} className="card space-y-4 p-5" resetOnSuccess>
          <h2 className="font-semibold">شحن المحفظة</h2>
          <div className="rounded-xl bg-earth-50 p-3 text-sm leading-7">
            حوّل المبلغ إلى أحد الحسابات التالية ثم أرسل الطلب مع رقم الحوالة أو صورة الإيصال:
            <ul className="mt-1 list-inside list-disc">
              <li>زين كاش: <b dir="ltr">{s.zaincashNumber}</b></li>
              <li>أو الدفع نقداً في مكتب المنصة - للاستفسار: <b dir="ltr">{s.supportPhone}</b></li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ (د.ع)"><input name="amount" type="number" min={5000} step={1000} required dir="ltr" className="input text-end" /></Field>
            <Field label="طريقة الدفع">
              <select name="method" className="input" required>
                {TOPUP_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="رقم الحوالة / المرجع"><input name="transferRef" dir="ltr" className="input" maxLength={120} /></Field>
          <Field label="صورة الإيصال (اختياري)"><input name="receipt" type="file" accept="image/*" className="input" /></Field>
          <SubmitButton pendingText="جارٍ الإرسال…">إرسال طلب الشحن</SubmitButton>
        </ActionForm>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">طلبات الشحن</h2>
          {topups.length === 0 ? (
            <p className="text-sm text-ink/55">لا توجد طلبات.</p>
          ) : (
            <ul className="divide-y divide-earth-50 text-sm">
              {topups.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium">{iqd(t.amount)}</div>
                    <div className="text-xs text-ink/50">{labelOf(TOPUP_METHODS, t.method)} · {dateTime(t.createdAt)}</div>
                    {t.adminNote && <div className="text-xs text-ink/60">{t.adminNote}</div>}
                  </div>
                  <Badge tone={t.status === "approved" ? "green" : t.status === "rejected" ? "red" : "amber"}>
                    {t.status === "approved" ? "تمت الإضافة" : t.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="p-5 pb-2 font-semibold">سجل الحركات</h2>
        <table className="table-base">
          <thead><tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th><th>المبلغ</th><th>الرصيد بعدها</th></tr></thead>
          <tbody>
            {txs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink/50">لا توجد حركات بعد.</td></tr>}
            {txs.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap text-xs">{dateTime(t.createdAt)}</td>
                <td className="whitespace-nowrap">{TX_TYPE_LABELS[t.type]}</td>
                <td className="text-xs text-ink/65">{t.note}</td>
                <td className={`whitespace-nowrap font-semibold tabular-nums ${t.amount > 0 ? "text-brand-700" : t.amount < 0 ? "text-red-600" : ""}`} dir="ltr">
                  {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("en")}
                </td>
                <td className="whitespace-nowrap tabular-nums">{iqd(t.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
