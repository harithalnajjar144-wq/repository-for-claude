import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { iqd } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Product, Provider, VetService } from "@/lib/types";
import { ContactButtons } from "@/components/ContactButtons";
import { DateTimePicker, toIso } from "@/components/DateTimePicker";
import { ReportButton } from "@/components/ReportButton";
import { Badge, Button, Card, ChipPicker, ErrorView, Field, Input, Loading, Row, T, Verified } from "@/components/ui";

type Detail = { provider: Provider; verificationStatus: string; services: VetService[]; products: Product[] };

export default function ProviderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn, user } = useAuth();
  const { city, productCategory } = useLabels();
  const q = useQuery({ queryKey: ["provider", id], queryFn: () => api<Detail>(`/providers/${id}`) });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  const { provider: p, verificationStatus, services, products } = q.data;
  const isOwner = user?.id === p.userId;
  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: p.kind === "vet" ? "العيادة" : "المحل" }} />
      <View style={{ height: 90, backgroundColor: colors.brand700 }} />
      <View style={{ padding: 16, gap: 14, marginTop: -50 }}>
        <Card style={{ gap: 8 }}>
          <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: colors.brand50, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.white }}>
            {p.logo ? <Image alt="" source={{ uri: fileUrl(p.logo) }} style={{ width: 76, height: 76 }} /> : <T size={34}>{p.kind === "vet" ? "🩺" : "🏪"}</T>}
          </View>
          <Row gap={6}>
            <T w="bold" size={20}>
              {p.businessName}
            </T>
            <Verified status={verificationStatus} />
          </Row>
          <T size={13} color={colors.muted}>
            📍 {city(p.city)}
            {p.address ? ` - ${p.address}` : ""}
          </T>
          {p.workingHours && (
            <T size={13} color={colors.muted}>
              🕒 {p.workingHours}
            </T>
          )}
          <Row wrap gap={4}>
            {p.homeVisits && <Badge label="زيارات منزلية" tone="green" />}
            {p.delivery && <Badge label="توصيل" tone="green" />}
            {p.specialties.map((s) => (
              <Badge key={s} label={s} tone="earth" />
            ))}
          </Row>
          {p.description && <T style={{ lineHeight: 25 }}>{p.description}</T>}
          {signedIn && p.phone ? <ContactButtons phone={p.phone} whatsapp={p.whatsapp} message="السلام عليكم، وصلت إليكم عن طريق تطبيق حلالي" /> : null}
          {isOwner && <Button title="إدارة نشاطي" variant="outline" onPress={() => router.push("/business")} />}
        </Card>

        {p.kind === "vet" ? (
          <VetSection p={p} services={services} canBook={signedIn && !isOwner} />
        ) : (
          <ShopSection p={p} products={products} canOrder={signedIn && !isOwner} categoryLabel={productCategory} />
        )}
        {!signedIn && <Button title="سجّل الدخول للحجز أو الطلب" onPress={() => router.push("/login")} />}
        {signedIn && !isOwner && <ReportButton targetType="provider" targetId={p.id} />}
      </View>
    </ScrollView>
  );
}

function VetSection({ p, services, canBook }: { p: Provider; services: VetService[]; canBook: boolean }) {
  const [serviceId, setServiceId] = useState<number>(0);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [animalType, setAnimalType] = useState("");
  const [count, setCount] = useState("1");
  const [homeVisit, setHomeVisit] = useState(false);
  const [notes, setNotes] = useState("");
  const book = useAction(
    () =>
      api(`/providers/${p.id}/bookings`, {
        body: { serviceId: serviceId || undefined, scheduledAt: date && time ? toIso(date, time) : undefined, animalType, animalCount: Number(count) || 1, homeVisit, notes },
      }),
    { success: "تم إرسال طلب الحجز. سيصلك إشعار عند تأكيده.", invalidate: [["my-bookings"]], onDone: () => router.push("/account/bookings") },
  );
  return (
    <>
      <Card style={{ gap: 8 }}>
        <T w="bold" size={17}>
          الخدمات والأسعار
        </T>
        {services.length === 0 ? (
          <T color={colors.muted}>لم تُضف الخدمات بعد. تواصل مع العيادة للاستفسار.</T>
        ) : (
          services.map((s) => (
            <Row key={s.id} style={{ justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
              <View style={{ flex: 1 }}>
                <T w="medium">{s.name}</T>
                {s.description && (
                  <T size={12} color={colors.muted}>
                    {s.description}
                  </T>
                )}
              </View>
              <T w="semibold" color={colors.brand700}>
                {s.price ? iqd(s.price) : "حسب الحالة"}
              </T>
            </Row>
          ))
        )}
      </Card>
      {canBook && (
        <Card style={{ gap: 12 }}>
          <T w="bold" size={17}>
            احجز موعداً
          </T>
          <Field label="الخدمة">
            <ChipPicker options={[{ value: 0, label: "استشارة / فحص عام" }, ...services.map((s) => ({ value: s.id, label: s.name }))]} value={serviceId} onChange={setServiceId} />
          </Field>
          <DateTimePicker date={date} time={time} onDate={setDate} onTime={setTime} />
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 2 }}>
              <Input label="نوع الحيوان" value={animalType} onChangeText={setAnimalType} placeholder="أغنام، قطة…" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="العدد" value={count} onChangeText={setCount} keyboardType="number-pad" />
            </View>
          </Row>
          {p.homeVisits && (
            <ChipPicker
              options={[
                { value: "no", label: "في العيادة" },
                { value: "yes", label: "زيارة منزلية / للحقل" },
              ]}
              value={homeVisit ? "yes" : "no"}
              onChange={(v) => setHomeVisit(v === "yes")}
            />
          )}
          <Input label="ملاحظات / الأعراض" value={notes} onChangeText={setNotes} multiline />
          <Button title="إرسال طلب الحجز" onPress={() => book.run()} loading={book.busy} disabled={!date || !time || !animalType.trim()} />
        </Card>
      )}
    </>
  );
}

function ShopSection({ p, products, canOrder, categoryLabel }: { p: Provider; products: Product[]; canOrder: boolean; categoryLabel: (k: string) => string }) {
  const { user } = useAuth();
  const [qty, setQty] = useState<Record<number, number>>({});
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const total = useMemo(() => products.reduce((s, pr) => s + pr.price * (qty[pr.id] ?? 0), 0), [qty, products]);
  const items = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([productId, quantity]) => ({ productId: Number(productId), quantity }));
  const order = useAction(() => api<{ id: number }>(`/providers/${p.id}/orders`, { body: { items, fulfilment, address, notes, phone: user?.phone } }), {
    success: (o) => `تم إرسال الطلب رقم #${o.id}. الدفع عند الاستلام.`,
    invalidate: [["provider", String(p.id)], ["my-orders"]],
    onDone: () => {
      setQty({});
      router.push("/account/orders");
    },
  });
  const step = (pr: Product, d: number) => setQty((q) => ({ ...q, [pr.id]: Math.max(0, Math.min(pr.stock, (q[pr.id] ?? 0) + d)) }));
  return (
    <>
      <T w="bold" size={17}>
        المنتجات
      </T>
      {products.length === 0 && <T color={colors.muted}>لا توجد منتجات معروضة بعد.</T>}
      {products.map((pr) => (
        <Card key={pr.id} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: colors.earth50, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {pr.images[0] ? <Image alt="" source={{ uri: fileUrl(pr.images[0]) }} style={{ width: 70, height: 70 }} /> : <T size={28}>📦</T>}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={11} color={colors.muted}>
              {categoryLabel(pr.category)}
            </T>
            <T w="medium">{pr.name}</T>
            <T w="bold" color={colors.brand700}>
              {iqd(pr.price)}
              {pr.unit ? (
                <T size={12} color={colors.muted}>
                  {" "}
                  / {pr.unit}
                </T>
              ) : null}
            </T>
            {pr.stock === 0 ? (
              <T size={12} color={colors.red}>
                نفد
              </T>
            ) : (
              canOrder && (
                <Row gap={10}>
                  <Stepper label="−" onPress={() => step(pr, -1)} />
                  <T w="bold">{qty[pr.id] ?? 0}</T>
                  <Stepper label="+" onPress={() => step(pr, 1)} />
                </Row>
              )
            )}
          </View>
        </Card>
      ))}
      {canOrder && items.length > 0 && (
        <Card style={{ gap: 12 }}>
          <T w="bold" size={17}>
            إتمام الطلب · {iqd(total)}
          </T>
          <ChipPicker
            options={[{ value: "pickup" as const, label: "استلام من المحل" }, ...(p.delivery ? [{ value: "delivery" as const, label: "توصيل" }] : [])]}
            value={fulfilment}
            onChange={setFulfilment}
          />
          {fulfilment === "delivery" && <Input label="عنوان التوصيل" value={address} onChangeText={setAddress} />}
          <Input label="ملاحظات" value={notes} onChangeText={setNotes} />
          <T size={12} color={colors.muted}>
            الدفع نقداً عند الاستلام.
          </T>
          <Button title="إرسال الطلب" onPress={() => order.run()} loading={order.busy} />
        </Card>
      )}
    </>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 32, height: 32, borderRadius: 99, borderWidth: 1, borderColor: colors.earth200, alignItems: "center", justifyContent: "center" }}>
      <T w="bold" size={18}>
        {label}
      </T>
    </Pressable>
  );
}
