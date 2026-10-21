import { ANIMAL_CATEGORIES, GOVERNORATES } from "@/lib/constants";
import type { Listing } from "@/db/schema";
import type { ActionState } from "@/lib/errors";
import { ActionForm, Field, ImagePicker, SubmitButton } from "./forms";

export function ListingForm({
  action,
  listing,
  defaultCity,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  listing?: Listing;
  defaultCity?: string;
}) {
  const l = listing;
  return (
    <ActionForm action={action} className="card space-y-6 p-6">
      {l && <input type="hidden" name="id" value={l.id} />}
      <fieldset className="flex gap-2">
        {[
          ["offer", "عرض للبيع", "لديك حيوانات تريد بيعها"],
          ["wanted", "طلب شراء", "تبحث عن حيوان محدد"],
        ].map(([v, t, d]) => (
          <label key={v} className="flex-1 cursor-pointer rounded-xl border border-earth-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="type" value={v} defaultChecked={(l?.type ?? "offer") === v} className="sr-only" />
            <div className="font-semibold">{t}</div>
            <div className="text-xs text-ink/55">{d}</div>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="نوع الحيوان">
          <select name="category" className="input" required defaultValue={l?.category ?? ""}>
            <option value="" disabled>اختر</option>
            {ANIMAL_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="السلالة" hint="مثال: عواسي، كرادي، شامي، هولشتاين">
          <input name="breed" className="input" maxLength={80} defaultValue={l?.breed ?? ""} />
        </Field>
      </div>

      <Field label="عنوان الإعلان">
        <input name="title" className="input" required minLength={5} maxLength={160} defaultValue={l?.title} placeholder="مثال: 10 نعاج عواسي حوامل بعمر سنتين" />
      </Field>

      <Field label="الوصف" hint="اذكر الحالة الصحية، التطعيمات، طريقة التربية، وأي تفاصيل تهم المشتري.">
        <textarea name="description" className="input min-h-32" required minLength={10} maxLength={5000} defaultValue={l?.description} />
      </Field>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="السعر (د.ع)" hint="اتركه فارغاً لـ «السعر عند الاتصال»" className="md:col-span-2">
          <input name="price" type="number" min={0} step={1000} dir="ltr" className="input text-end" defaultValue={l?.price ?? ""} />
        </Field>
        <Field label="العدد">
          <input name="quantity" type="number" min={1} className="input" defaultValue={l?.quantity ?? 1} />
        </Field>
        <label className="flex items-end gap-2 pb-3 text-sm">
          <input type="checkbox" name="negotiable" defaultChecked={l?.negotiable ?? true} className="h-4 w-4 accent-brand-600" />
          قابل للتفاوض
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="العمر (بالأشهر)">
          <input name="ageMonths" type="number" min={0} max={600} className="input" defaultValue={l?.ageMonths ?? ""} />
        </Field>
        <Field label="الجنس">
          <select name="gender" className="input" defaultValue={l?.gender ?? "unknown"}>
            <option value="unknown">غير محدد</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
            <option value="mixed">مختلط</option>
          </select>
        </Field>
        <Field label="الوزن التقريبي (كغم)">
          <input name="weightKg" type="number" min={0} className="input" defaultValue={l?.weightKg ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="المحافظة">
          <select name="city" className="input" required defaultValue={l?.city ?? defaultCity ?? ""}>
            <option value="" disabled>اختر</option>
            {GOVERNORATES.map((g) => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </Field>
        <Field label="المنطقة / القضاء">
          <input name="area" className="input" maxLength={80} defaultValue={l?.area ?? ""} />
        </Field>
      </div>

      <ImagePicker existing={l?.images} />

      <div className="flex justify-end">
        <SubmitButton pendingText="جارٍ النشر…">{l ? "حفظ التعديلات" : "نشر الإعلان"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
