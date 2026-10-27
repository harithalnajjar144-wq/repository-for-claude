import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toInt } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import type { Product } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { ImagesField } from "@/components/ImagesField";
import { Button, ChipPicker, Field, Input, Loading, Row, Screen } from "@/components/ui";

export default function ProductScreen() {
  return (
    <AuthGate>
      <Load />
    </AuthGate>
  );
}

function Load() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useQuery({ queryKey: ["business"], queryFn: () => api<{ products: Product[] }>("/me/business") });
  if (q.isLoading) return <Loading />;
  const p = id ? q.data?.products.find((x) => x.id === Number(id)) : undefined;
  return <Form p={p} />;
}

function Form({ p }: { p?: Product }) {
  const { data: meta } = useMeta();
  const [v, setV] = useState({
    name: p?.name ?? "",
    category: p?.category ?? "feed",
    description: p?.description ?? "",
    price: p ? String(p.price) : "",
    unit: p?.unit ?? "",
    stock: p ? String(p.stock) : "0",
    images: p?.images ?? [],
  });
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = useAction(
    () =>
      api(p ? `/me/business/products/${p.id}` : "/me/business/products", {
        method: p ? "PATCH" : "POST",
        body: { ...v, price: toInt(v.price), stock: toInt(v.stock) ?? 0 },
      }),
    { success: "تم حفظ المنتج", invalidate: [["business"]], onDone: () => router.back() },
  );
  return (
    <Screen>
      <Input label="اسم المنتج" value={v.name} onChangeText={set("name")} />
      <Field label="الفئة">
        <ChipPicker options={(meta?.productCategories ?? []).map((c) => ({ value: c.key, label: c.label }))} value={v.category} onChange={set("category")} />
      </Field>
      <Input label="الوصف" value={v.description} onChangeText={set("description")} multiline />
      <Row style={{ alignItems: "flex-start" }}>
        <Field label="السعر (د.ع)" style={{ flex: 1 }}>
          <Input value={v.price} onChangeText={(x) => set("price")(String(toInt(x) ?? ""))} keyboardType="number-pad" />
        </Field>
        <Field label="الوحدة" style={{ flex: 1 }}>
          <Input value={v.unit} onChangeText={set("unit")} placeholder="كيس 50 كغم" />
        </Field>
        <Field label="المخزون" style={{ flex: 1 }}>
          <Input value={v.stock} onChangeText={(x) => set("stock")(String(toInt(x) ?? ""))} keyboardType="number-pad" />
        </Field>
      </Row>
      <ImagesField value={v.images} onChange={set("images")} max={4} />
      <Button title={p ? "حفظ" : "إضافة المنتج"} onPress={() => save.run()} loading={save.busy} />
    </Screen>
  );
}
