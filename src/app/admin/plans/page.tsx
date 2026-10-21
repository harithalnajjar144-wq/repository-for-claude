import { asc } from "drizzle-orm";
import { db } from "@/db";
import { plans, type Plan } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/constants";
import { iqd } from "@/lib/format";
import { savePlanAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, PageHeader } from "@/components/ui";

function PlanForm({ p }: { p?: Plan }) {
  return (
    <ActionForm action={savePlanAction} className="space-y-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid grid-cols-2 gap-2">
        <Field label="الاسم"><input name="name" className="input" defaultValue={p?.name} required /></Field>
        <Field label="المعرّف (إنجليزي)"><input name="slug" dir="ltr" className="input" defaultValue={p?.slug} required /></Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="لنوع الحساب">
          <select name="role" className="input" defaultValue={p?.role ?? "trader"}>
            {["trader", "vet", "shop", "user"].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <Field label="السعر الشهري"><input name="priceMonthly" type="number" min={0} step={1000} className="input" defaultValue={p?.priceMonthly ?? 0} /></Field>
        <Field label="الترتيب"><input name="sortOrder" type="number" className="input" defaultValue={p?.sortOrder ?? 0} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="حد الإعلانات النشطة" hint="فارغ = غير محدود"><input name="maxActiveListings" type="number" min={0} className="input" defaultValue={p?.maxActiveListings ?? ""} /></Field>
        <Field label="حد المزادات النشطة" hint="فارغ = غير محدود"><input name="maxActiveAuctions" type="number" min={0} className="input" defaultValue={p?.maxActiveAuctions ?? ""} /></Field>
      </div>
      <Field label="المزايا (سطر لكل ميزة)"><textarea name="features" className="input" defaultValue={p?.features.join("\n")} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} className="h-4 w-4 accent-brand-600" /> مفعّلة</label>
      <SubmitButton>{p ? "حفظ" : "إضافة باقة"}</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminPlans() {
  const rows = await db.select().from(plans).orderBy(asc(plans.role), asc(plans.sortOrder));
  return (
    <div className="space-y-4">
      <PageHeader title="الباقات والاشتراكات" />
      {rows.map((p) => (
        <details key={p.id} className="card">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
            <b>{p.name}</b><Badge tone="earth">{ROLE_LABELS[p.role]}</Badge><span>{iqd(p.priceMonthly)} / شهر</span>
            {!p.isActive && <Badge tone="gray">معطلة</Badge>}
          </summary>
          <div className="border-t border-earth-50 p-4"><PlanForm p={p} /></div>
        </details>
      ))}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">باقة جديدة</h2>
        <PlanForm />
      </div>
    </div>
  );
}
