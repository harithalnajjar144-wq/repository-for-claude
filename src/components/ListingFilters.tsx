import Link from "next/link";
import { ANIMAL_CATEGORIES, GOVERNORATES } from "@/lib/constants";
import type { ListingFilters as F } from "@/lib/queries";

export function ListingFilters({ f }: { f: F }) {
  return (
    <form method="get" action="/listings" className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="q">بحث</label>
        <input id="q" name="q" defaultValue={f.q} className="input" placeholder="سلالة، عنوان…" />
      </div>
      <div>
        <label className="label" htmlFor="category">نوع الحيوان</label>
        <select id="category" name="category" defaultValue={f.category ?? ""} className="input">
          <option value="">الكل</option>
          {ANIMAL_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="city">المحافظة</label>
        <select id="city" name="city" defaultValue={f.city ?? ""} className="input">
          <option value="">كل العراق</option>
          {GOVERNORATES.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
      </div>
      <div>
        <span className="label">نوع الإعلان</span>
        <div className="flex gap-1 rounded-xl bg-earth-50 p-1 text-sm">
          {[["", "الكل"], ["offer", "للبيع"], ["wanted", "مطلوب"]].map(([v, l]) => (
            <label key={v} className="flex-1 cursor-pointer rounded-lg py-1.5 text-center has-[:checked]:bg-white has-[:checked]:font-semibold has-[:checked]:shadow-sm">
              <input type="radio" name="type" value={v} defaultChecked={(f.type ?? "") === v} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="label">السعر (د.ع)</span>
        <div className="flex gap-2">
          <input name="minPrice" type="number" min={0} step={1000} defaultValue={f.minPrice} className="input" placeholder="من" dir="ltr" />
          <input name="maxPrice" type="number" min={0} step={1000} defaultValue={f.maxPrice} className="input" placeholder="إلى" dir="ltr" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sort">الترتيب</label>
        <select id="sort" name="sort" defaultValue={f.sort ?? ""} className="input">
          <option value="">الأحدث</option>
          <option value="price_asc">السعر: الأقل أولاً</option>
          <option value="price_desc">السعر: الأعلى أولاً</option>
          <option value="popular">الأكثر مشاهدة</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="verified" value="1" defaultChecked={f.verified === "1"} className="h-4 w-4 accent-brand-600" />
        البائعون الموثقون فقط
      </label>
      <button className="btn-primary w-full">تطبيق</button>
      <Link href="/listings" className="block text-center text-xs text-ink/50 hover:text-ink">مسح الفلاتر</Link>
    </form>
  );
}
