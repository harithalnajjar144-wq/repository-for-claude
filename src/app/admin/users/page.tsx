import { desc, ilike, or, eq, and, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cityLabel, ROLE_LABELS, VERIFICATION_LABELS } from "@/lib/constants";
import { dateOnly, iqd } from "@/lib/format";
import { adjustWalletAction, updateUserAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, PageHeader } from "@/components/ui";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const { q, role } = await searchParams;
  const me = await getCurrentUser();
  const where: SQL[] = [];
  if (q?.trim()) where.push(or(ilike(users.name, `%${q.trim()}%`), ilike(users.phone, `%${q.trim()}%`))!);
  if (role) where.push(eq(users.role, role as "user"));
  const rows = await db.select().from(users).where(where.length ? and(...where) : undefined).orderBy(desc(users.createdAt)).limit(100);
  return (
    <div>
      <PageHeader title="المستخدمون" />
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="الاسم أو رقم الهاتف" className="input flex-1" />
        <select name="role" defaultValue={role ?? ""} className="input w-auto">
          <option value="">كل الأنواع</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary">بحث</button>
      </form>
      <div className="space-y-2">
        {rows.map((u) => (
          <details key={u.id} className="card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="font-semibold">{u.name}</span>
              <span className="text-sm text-ink/55" dir="ltr">{u.phone}</span>
              <Badge tone="earth">{ROLE_LABELS[u.role]}</Badge>
              <Badge tone={u.verificationStatus === "verified" ? "green" : u.verificationStatus === "pending" ? "amber" : "gray"}>{VERIFICATION_LABELS[u.verificationStatus]}</Badge>
              {u.isBanned && <Badge tone="red">موقوف</Badge>}
              <span className="ms-auto text-sm">{iqd(u.walletBalance)}</span>
              <span className="text-xs text-ink/45">{cityLabel(u.city)} · {dateOnly(u.createdAt)}</span>
            </summary>
            <div className="grid gap-4 border-t border-earth-50 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <form action={updateUserAction} className="flex gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="op" value="role" />
                  <select name="role" defaultValue={u.role} className="input">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn-outline" disabled={u.id === me?.id}>تغيير النوع</button>
                </form>
                <form action={updateUserAction} className="flex gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  {u.isBanned ? (
                    <button name="op" value="unban" className="btn-outline">رفع الإيقاف</button>
                  ) : (
                    <button name="op" value="ban" className="btn-danger" disabled={u.id === me?.id}>إيقاف الحساب</button>
                  )}
                  {u.verificationStatus === "verified" && <button name="op" value="unverify" className="btn-outline">إلغاء التوثيق</button>}
                </form>
              </div>
              <ActionForm action={adjustWalletAction} className="space-y-2" resetOnSuccess>
                <input type="hidden" name="userId" value={u.id} />
                <div className="text-sm font-semibold">تسوية المحفظة</div>
                <div className="flex gap-2">
                  <input name="amount" type="number" step={1000} placeholder="+50000 أو -10000" dir="ltr" className="input w-40" required />
                  <input name="note" placeholder="السبب" className="input flex-1" required />
                </div>
                <SubmitButton className="btn-outline" confirm="تأكيد التسوية؟">تنفيذ</SubmitButton>
              </ActionForm>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
