import { desc } from "drizzle-orm";
import { db } from "@/db";
import { ads, type Ad } from "@/db/schema";
import { dateOnly, num } from "@/lib/format";
import { saveAdAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, PageHeader } from "@/components/ui";

function AdForm({ a }: { a?: Ad }) {
  return (
    <ActionForm action={saveAdAction} className="space-y-3">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-2 md:grid-cols-2">
        <Field label="العنوان"><input name="title" className="input" defaultValue={a?.title} required /></Field>
        <Field label="المعلن"><input name="advertiser" className="input" defaultValue={a?.advertiser ?? ""} /></Field>
      </div>
      <Field label="النص الفرعي"><input name="subtitle" className="input" defaultValue={a?.subtitle ?? ""} /></Field>
      <div className="grid gap-2 md:grid-cols-3">
        <Field label="الرابط"><input name="linkUrl" dir="ltr" className="input" defaultValue={a?.linkUrl ?? ""} placeholder="https://" /></Field>
        <Field label="الموضع">
          <select name="placement" className="input" defaultValue={a?.placement ?? "home_top"}>
            <option value="home_top">الصفحة الرئيسية</option>
            <option value="listings_side">جانب نتائج السوق</option>
          </select>
        </Field>
        <Field label="ينتهي في"><input name="endsAt" type="date" className="input" defaultValue={a?.endsAt ? new Date(a.endsAt.getTime() + 3 * 3600_000).toISOString().slice(0, 10) : ""} /></Field>
      </div>
      <Field label="الصورة (اختياري)"><input name="image" type="file" accept="image/*" className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={a?.isActive ?? true} className="h-4 w-4 accent-brand-600" /> مفعّل</label>
      <SubmitButton>{a ? "حفظ" : "إضافة"}</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminAds() {
  const rows = await db.select().from(ads).orderBy(desc(ads.createdAt));
  return (
    <div className="space-y-4">
      <PageHeader title="المساحات الإعلانية" subtitle="إعلانات مدفوعة للمعلنين (شركات أعلاف، أدوية، معارض) تظهر في المنصة." />
      {rows.map((a) => (
        <details key={a.id} className="card">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
            <b>{a.title}</b>{a.advertiser && <span className="text-sm text-ink/55">{a.advertiser}</span>}
            <Badge tone={a.isActive ? "green" : "gray"}>{a.isActive ? "مفعّل" : "متوقف"}</Badge>
            <span className="text-xs text-ink/50">{num(a.impressions)} ظهور · {num(a.clicks)} نقرة{a.endsAt && ` · حتى ${dateOnly(a.endsAt)}`}</span>
          </summary>
          <div className="border-t border-earth-50 p-4"><AdForm a={a} /></div>
        </details>
      ))}
      <div className="card p-5"><h2 className="mb-3 font-semibold">إعلان جديد</h2><AdForm /></div>
    </div>
  );
}
