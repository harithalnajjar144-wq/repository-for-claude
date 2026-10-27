import { useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import type { Product, Provider, VetService } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { ImagesField } from "@/components/ImagesField";
import { Button, ErrorView, Input, Loading, Row, Screen, Select, Switch } from "@/components/ui";

type Biz = { provider: Provider; services: VetService[]; products: Product[] };

export default function BusinessProfile() {
  return (
    <AuthGate>
      <Load />
    </AuthGate>
  );
}

function Load() {
  const q = useQuery({ queryKey: ["business"], queryFn: () => api<Biz>("/me/business") });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  return <Form p={q.data.provider} />;
}

function Form({ p }: { p: Provider }) {
  const { data: meta } = useMeta();
  const isVet = p.kind === "vet";
  const [v, setV] = useState({
    businessName: p.businessName,
    description: p.description ?? "",
    city: p.city,
    address: p.address ?? "",
    phone: p.phone ?? "",
    whatsapp: p.whatsapp ?? "",
    workingHours: p.workingHours ?? "",
    specialties: p.specialties.join("، "),
    homeVisits: p.homeVisits,
    delivery: p.delivery,
    isActive: p.isActive,
    logo: p.logo ? [p.logo] : ([] as string[]),
  });
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = useAction(() => api("/me/business", { method: "PATCH", body: { ...v, logo: v.logo[0] ?? null } }), {
    success: "تم حفظ الملف التجاري",
    invalidate: [["business"], ["me"], ["provider", String(p.id)]],
  });
  return (
    <Screen>
      <Row>
        <Button title="عرض الصفحة العامة" variant="outline" small onPress={() => router.push({ pathname: "/provider/[id]", params: { id: String(p.id) } })} />
      </Row>
      <ImagesField label="الشعار / صورة العيادة" value={v.logo} onChange={set("logo")} max={1} />
      <Input label={isVet ? "اسم العيادة / الطبيب" : "اسم المحل"} value={v.businessName} onChangeText={set("businessName")} />
      <Select label="المحافظة" value={v.city} onChange={set("city")} options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))} />
      <Input label="العنوان التفصيلي" value={v.address} onChangeText={set("address")} />
      <Input label="نبذة" value={v.description} onChangeText={set("description")} multiline />
      <Input label="هاتف العمل" value={v.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <Input label="واتساب" value={v.whatsapp} onChangeText={set("whatsapp")} keyboardType="phone-pad" />
      <Input label="أوقات الدوام" placeholder="السبت-الخميس 9ص - 9م" value={v.workingHours} onChangeText={set("workingHours")} />
      <Input
        label={isVet ? "التخصصات (افصل بفاصلة)" : "الأصناف الرئيسية (افصل بفاصلة)"}
        hint={isVet ? `مثال: ${(meta?.vetSpecialties ?? []).slice(0, 4).join("، ")}` : "مثال: أعلاف، أدوية بيطرية، مستلزمات قطط"}
        value={v.specialties}
        onChangeText={set("specialties")}
      />
      {isVet ? (
        <Switch label="أقدم زيارات منزلية / للحقول" value={v.homeVisits} onChange={set("homeVisits")} />
      ) : (
        <Switch label="أوفر خدمة التوصيل" value={v.delivery} onChange={set("delivery")} />
      )}
      <Switch label="الصفحة ظاهرة للعامة" value={v.isActive} onChange={set("isActive")} />
      <Button title="حفظ" onPress={() => save.run()} loading={save.busy} />
    </Screen>
  );
}
