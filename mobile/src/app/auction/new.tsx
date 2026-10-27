import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { iqd, toInt } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import type { Auction } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { DateTimePicker, toIso } from "@/components/DateTimePicker";
import { ImagesField } from "@/components/ImagesField";
import { Button, Card, ChipPicker, Field, Input, Notice, Row, Screen, Select, T } from "@/components/ui";

export default function NewAuction() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { user, me } = useAuth();
  const { data: meta } = useMeta();
  const [v, setV] = useState({
    title: "",
    description: "",
    category: "",
    breed: "",
    quantity: "1",
    ageMonths: "",
    gender: "unknown",
    weightKg: "",
    city: user?.city ?? "",
    startPrice: "",
    minIncrement: "",
    reservePrice: "",
    depositAmount: "",
    startMode: "now" as "now" | "scheduled",
    date: null as string | null,
    time: null as string | null,
    durationHours: 24,
    images: [] as string[],
  });
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV((s) => ({ ...s, [k]: x }));
  const numeric = (k: "quantity" | "ageMonths" | "weightKg" | "startPrice" | "minIncrement" | "reservePrice" | "depositAmount") => (x: string) =>
    set(k)(String(toInt(x) ?? ""));

  const create = useAction(
    () =>
      api<Auction>("/auctions", {
        body: {
          ...v,
          quantity: toInt(v.quantity) ?? 1,
          ageMonths: toInt(v.ageMonths),
          weightKg: toInt(v.weightKg),
          startPrice: toInt(v.startPrice),
          minIncrement: toInt(v.minIncrement),
          reservePrice: toInt(v.reservePrice),
          depositAmount: toInt(v.depositAmount),
          startsAt: v.startMode === "scheduled" && v.date && v.time ? toIso(v.date, v.time) : undefined,
        },
      }),
    {
      success: "✅ تم إطلاق المزاد",
      invalidate: [["auctions"], ["home"], ["my-auctions"]],
      onDone: (a) => router.replace({ pathname: "/auction/[id]", params: { id: String(a.id) } }),
    },
  );

  const s = meta?.settings;
  if (user && user.role !== "trader" && user.role !== "admin") return <Screen><Notice tone="red">فتح المزادات متاح لحسابات «تاجر / مربي» فقط.</Notice></Screen>;
  return (
    <Screen>
      {s?.requireVerificationForAuctions && user?.verificationStatus !== "verified" && (
        <Notice>يجب توثيق حسابك قبل فتح مزاد.</Notice>
      )}
      {s && (
        <Notice tone="blue">
          {`عمولة المنصة ${(s.auctionCommissionRate * 100).toFixed(1)}% من السعر النهائي، تُخصم من محفظتك عند نجاح المزاد فقط.${me?.subscription ? ` باقتك: ${me.subscription.plan.name}.` : ` الحساب المجاني يسمح بـ ${s.freeActiveAuctions} مزاد نشط.`}`}
        </Notice>
      )}
      <Input label="عنوان المزاد" placeholder="مثال: فحل عربي أصيل بعمر 4 سنوات" value={v.title} onChangeText={set("title")} />
      <Select label="نوع الحيوان" value={v.category} onChange={set("category")} options={(meta?.animalCategories ?? []).map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
      <Input label="السلالة" value={v.breed} onChangeText={set("breed")} />
      <Input label="الوصف" hint="النسب، الشهادات، الحالة الصحية، الإنجازات." value={v.description} onChangeText={set("description")} multiline />
      <Row style={{ alignItems: "flex-start" }}>
        <Field label="العدد" style={{ flex: 1 }}><Input value={v.quantity} onChangeText={numeric("quantity")} keyboardType="number-pad" /></Field>
        <Field label="العمر (أشهر)" style={{ flex: 1 }}><Input value={v.ageMonths} onChangeText={numeric("ageMonths")} keyboardType="number-pad" /></Field>
        <Field label="الوزن (كغم)" style={{ flex: 1 }}><Input value={v.weightKg} onChangeText={numeric("weightKg")} keyboardType="number-pad" /></Field>
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

      <Card style={{ gap: 12 }}>
        <T w="semibold">التسعير والتأمين</T>
        <Input label="سعر البداية (د.ع)" value={v.startPrice} onChangeText={numeric("startPrice")} keyboardType="number-pad" />
        <Input label="أقل زيادة (اختياري)" hint="يُحسب تلقائياً ≈1% من سعر البداية" value={v.minIncrement} onChangeText={numeric("minIncrement")} keyboardType="number-pad" />
        <Input label="السعر الأدنى المخفي (اختياري)" hint="لن يُباع إذا لم تصل المزايدات لهذا السعر" value={v.reservePrice} onChangeText={numeric("reservePrice")} keyboardType="number-pad" />
        <Input
          label="التأمين على المزايد (اختياري)"
          hint={s ? `الحد الأدنى ${Math.round(s.minDepositRate * 100)}% من سعر البداية أو ${iqd(s.minDepositAmount)}` : undefined}
          value={v.depositAmount}
          onChangeText={numeric("depositAmount")}
          keyboardType="number-pad"
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <T w="semibold">التوقيت</T>
        <ChipPicker
          options={[
            { value: "now", label: "ابدأ فوراً" },
            { value: "scheduled", label: "جدولة لوقت لاحق" },
          ]}
          value={v.startMode}
          onChange={set("startMode")}
        />
        {v.startMode === "scheduled" && <DateTimePicker date={v.date} time={v.time} onDate={set("date")} onTime={set("time")} days={30} from={0} to={23} step={60} />}
        <Field label="مدة المزاد">
          <ChipPicker options={(meta?.auctionDurations ?? []).map((d) => ({ value: d.hours, label: d.label }))} value={v.durationHours} onChange={set("durationHours")} />
        </Field>
      </Card>

      <ImagesField value={v.images} onChange={set("images")} />
      <Button title="إطلاق المزاد" variant="earth" onPress={() => create.run()} loading={create.busy} />
    </Screen>
  );
}
