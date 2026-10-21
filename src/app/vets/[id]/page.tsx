import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers, users, vetServices } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { iqd } from "@/lib/format";
import { createBookingAction } from "@/app/actions/providers";
import { ProviderHeader } from "@/components/ProviderHeader";
import { ReportForm } from "@/components/ReportForm";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

/** Today's date in Baghdad (UTC+3) as YYYY-MM-DD. */
const baghdadToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

export default async function VetPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const [row] = await db
    .select({ p: providers, v: users.verificationStatus, banned: users.isBanned })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(and(eq(providers.id, id), eq(providers.kind, "vet")));
  if (!row || row.banned) notFound();
  const user = await getCurrentUser();
  const services = await db
    .select()
    .from(vetServices)
    .where(and(eq(vetServices.providerId, id), eq(vetServices.isActive, true)));
  const today = baghdadToday();
  const isOwner = user?.id === row.p.userId;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ProviderHeader p={row.p} verification={row.v} loggedIn={!!user} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-bold">الخدمات والأسعار</h2>
          {services.length === 0 ? (
            <p className="text-sm text-ink/55">لم تُضف الخدمات بعد. تواصل مع العيادة للاستفسار.</p>
          ) : (
            <ul className="divide-y divide-earth-50">
              {services.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.description && <div className="text-sm text-ink/60">{s.description}</div>}
                    <div className="text-xs text-ink/45">المدة: {s.durationMinutes} دقيقة</div>
                  </div>
                  <div className="shrink-0 font-semibold text-brand-700">{s.price ? iqd(s.price) : "حسب الحالة"}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-4">
          {isOwner ? (
            <div className="card p-5 text-sm">
              هذه صفحة عيادتك العامة. <Link href="/dashboard/business" className="font-semibold text-brand-700">إدارة الخدمات والحجوزات</Link>
            </div>
          ) : user ? (
            <ActionForm action={createBookingAction} className="card space-y-3 p-5" resetOnSuccess>
              <h2 className="text-lg font-bold">احجز موعداً</h2>
              <input type="hidden" name="providerId" value={row.p.id} />
              <Field label="الخدمة">
                <select name="serviceId" className="input" defaultValue="">
                  <option value="">استشارة / فحص عام</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="التاريخ"><input type="date" name="date" min={today} required className="input" /></Field>
                <Field label="الوقت"><input type="time" name="time" required className="input" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="نوع الحيوان"><input name="animalType" required className="input" placeholder="أغنام، قطة…" /></Field>
                <Field label="العدد"><input type="number" name="animalCount" min={1} defaultValue={1} className="input" /></Field>
              </div>
              {row.p.homeVisits && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="homeVisit" className="h-4 w-4 accent-brand-600" /> أطلب زيارة منزلية / للحقل</label>
              )}
              <Field label="ملاحظات / الأعراض"><textarea name="notes" className="input" maxLength={2000} /></Field>
              <SubmitButton className="btn-primary w-full" pendingText="جارٍ الإرسال…">إرسال طلب الحجز</SubmitButton>
            </ActionForm>
          ) : (
            <div className="card p-5">
              <Link href={`/login?next=/vets/${row.p.id}`} className="btn-primary w-full">سجّل الدخول للحجز</Link>
            </div>
          )}
          {user && !isOwner && <ReportForm targetType="provider" targetId={row.p.id} />}
        </aside>
      </div>
    </div>
  );
}
