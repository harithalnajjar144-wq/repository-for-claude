import { useState } from "react";
import { useMeta } from "@/lib/meta";
import { toInt } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { Button, ChipPicker, Field, Input, Row, Select, Switch } from "./ui";
import { ImagesField } from "./ImagesField";

export type ListingFormValue = {
  type: "offer" | "wanted";
  category: string;
  breed: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  quantity: string;
  ageMonths: string;
  gender: Listing["gender"];
  weightKg: string;
  city: string;
  area: string;
  images: string[];
};

export const listingToForm = (l?: Partial<Listing>, city = ""): ListingFormValue => ({
  type: l?.type ?? "offer",
  category: l?.category ?? "",
  breed: l?.breed ?? "",
  title: l?.title ?? "",
  description: l?.description ?? "",
  price: l?.price != null ? String(l.price) : "",
  negotiable: l?.negotiable ?? true,
  quantity: String(l?.quantity ?? 1),
  ageMonths: l?.ageMonths != null ? String(l.ageMonths) : "",
  gender: l?.gender ?? "unknown",
  weightKg: l?.weightKg != null ? String(l.weightKg) : "",
  city: l?.city ?? city,
  area: l?.area ?? "",
  images: l?.images ?? [],
});

/** JSON body for POST/PATCH /listings. */
export const formToBody = (v: ListingFormValue) => ({
  ...v,
  price: toInt(v.price),
  quantity: toInt(v.quantity) ?? 1,
  ageMonths: toInt(v.ageMonths),
  weightKg: toInt(v.weightKg),
});

export function ListingForm({ initial, onSubmit, busy, submitLabel }: { initial: ListingFormValue; onSubmit: (v: ListingFormValue) => void; busy: boolean; submitLabel: string }) {
  const { data: meta } = useMeta();
  const [v, setV] = useState(initial);
  const set = <K extends keyof ListingFormValue>(k: K) => (x: ListingFormValue[K]) => setV((s) => ({ ...s, [k]: x }));
  const numeric = (k: "price" | "quantity" | "ageMonths" | "weightKg") => (x: string) => set(k)(String(toInt(x) ?? ""));
  return (
    <>
      <Field label="نوع الإعلان">
        <ChipPicker
          options={[
            { value: "offer", label: "عرض للبيع" },
            { value: "wanted", label: "طلب شراء" },
          ]}
          value={v.type}
          onChange={set("type")}
        />
      </Field>
      <Select label="نوع الحيوان" value={v.category} onChange={set("category")} options={(meta?.animalCategories ?? []).map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
      <Input label="السلالة" hint="مثال: عواسي، كرادي، شامي، هولشتاين" value={v.breed} onChangeText={set("breed")} />
      <Input label="عنوان الإعلان" placeholder="مثال: 10 نعاج عواسي حوامل بعمر سنتين" value={v.title} onChangeText={set("title")} maxLength={160} />
      <Input label="الوصف" hint="الحالة الصحية، التطعيمات، طريقة التربية، وأي تفاصيل تهم المشتري." value={v.description} onChangeText={set("description")} multiline maxLength={5000} />
      <Input label="السعر (د.ع)" hint="اتركه فارغاً لـ «السعر عند الاتصال»" value={v.price} onChangeText={numeric("price")} keyboardType="number-pad" />
      <Switch label="قابل للتفاوض" value={v.negotiable} onChange={set("negotiable")} />
      <Row style={{ alignItems: "flex-start" }}>
        <InputCol label="العدد" value={v.quantity} onChange={numeric("quantity")} />
        <InputCol label="العمر (أشهر)" value={v.ageMonths} onChange={numeric("ageMonths")} />
        <InputCol label="الوزن (كغم)" value={v.weightKg} onChange={numeric("weightKg")} />
      </Row>
      <Field label="الجنس">
        <ChipPicker
          options={[
            { value: "unknown", label: "غير محدد" },
            { value: "male", label: "ذكر" },
            { value: "female", label: "أنثى" },
            { value: "mixed", label: "مختلط" },
          ]}
          value={v.gender}
          onChange={set("gender")}
        />
      </Field>
      <Select label="المحافظة" value={v.city} onChange={set("city")} options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))} />
      <Input label="المنطقة / القضاء" value={v.area} onChangeText={set("area")} />
      <ImagesField value={v.images} onChange={set("images")} />
      <Button title={submitLabel} onPress={() => onSubmit(v)} loading={busy} />
    </>
  );
}

function InputCol({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <Field label={label} style={{ flex: 1 }}>
      <Input value={value} onChangeText={onChange} keyboardType="number-pad" />
    </Field>
  );
}
