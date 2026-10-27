import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { iqd, toInt } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { colors } from "@/lib/theme";
import type { VetService } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Button, Card, Input, Loading, Row, Screen, SectionTitle, T } from "@/components/ui";

export default function Services() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

const blank = { id: 0, name: "", description: "", price: "", durationMinutes: "30" };

function Content() {
  const q = useQuery({ queryKey: ["business"], queryFn: () => api<{ services: VetService[] }>("/me/business") });
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f) => (x: string) => setF((s) => ({ ...s, [k]: x }));
  const save = useAction(
    () =>
      api(f.id ? `/me/business/services/${f.id}` : "/me/business/services", {
        method: f.id ? "PATCH" : "POST",
        body: { name: f.name, description: f.description, price: toInt(f.price), durationMinutes: toInt(f.durationMinutes) ?? 30 },
      }),
    { success: "تم حفظ الخدمة", invalidate: [["business"]], onDone: () => setF(blank) },
  );
  const del = useAction((id: number) => api(`/me/business/services/${id}`, { method: "DELETE" }), {
    success: "تم الحذف",
    invalidate: [["business"]],
    confirm: "حذف الخدمة؟",
    danger: true,
  });
  if (q.isLoading) return <Loading />;
  return (
    <Screen>
      {q.data?.services.length === 0 && <T color={colors.muted}>أضف خدماتك وأسعارها ليتمكن المربون من الحجز.</T>}
      {q.data?.services.map((s) => (
        <Card key={s.id} style={{ gap: 4 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T w="semibold" style={{ flex: 1 }}>
              {s.name}
            </T>
            <T color={colors.brand700} w="semibold">
              {s.price ? iqd(s.price) : "حسب الحالة"}
            </T>
          </Row>
          <T size={12} color={colors.muted}>
            {s.durationMinutes} دقيقة
          </T>
          <Row>
            <Button
              title="تعديل"
              variant="outline"
              small
              onPress={() => setF({ id: s.id, name: s.name, description: s.description ?? "", price: s.price ? String(s.price) : "", durationMinutes: String(s.durationMinutes) })}
            />
            <Button title="حذف" variant="ghost" small onPress={() => del.run(s.id)} />
          </Row>
        </Card>
      ))}
      <SectionTitle title={f.id ? "تعديل الخدمة" : "إضافة خدمة"} />
      <Card style={{ gap: 10 }}>
        <Input label="اسم الخدمة" placeholder="مثال: تلقيح الأغنام ضد الحمى القلاعية" value={f.name} onChangeText={set("name")} />
        <Input label="الوصف" value={f.description} onChangeText={set("description")} />
        <Row>
          <Input label="السعر (د.ع)" value={f.price} onChangeText={set("price")} keyboardType="number-pad" fieldStyle={{ flex: 1 }} />
          <Input label="المدة (دقيقة)" value={f.durationMinutes} onChangeText={set("durationMinutes")} keyboardType="number-pad" fieldStyle={{ flex: 1 }} />
        </Row>
        <Button title={f.id ? "حفظ" : "إضافة"} onPress={() => save.run()} loading={save.busy} />
        {f.id ? <Button title="إلغاء التعديل" variant="ghost" onPress={() => setF(blank)} /> : null}
      </Card>
    </Screen>
  );
}
