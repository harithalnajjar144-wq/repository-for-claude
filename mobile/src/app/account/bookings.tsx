import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Booking } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Loading, Row, Screen, T } from "@/components/ui";

export default function MyBookings() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["my-bookings"], queryFn: () => api<Booking[]>("/me/bookings") });
  const cancel = useAction((id: number) => api(`/bookings/${id}/status`, { body: { status: "cancelled" } }), {
    success: "تم إلغاء الموعد",
    invalidate: [["my-bookings"]],
    confirm: "إلغاء الموعد؟",
    danger: true,
  });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Button title="احجز عند طبيب بيطري" variant="outline" onPress={() => router.push({ pathname: "/(tabs)/services", params: { kind: "vet" } })} />
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="🩺" title="لا توجد حجوزات" />
      ) : (
        q.data.map((b) => (
          <Card key={b.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T w="semibold">{b.provider?.businessName}</T>
              <Badge label={meta?.labels.bookingStatus[b.status] ?? b.status} tone={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "gray"} />
            </Row>
            <T size={14}>📅 {dateTime(b.scheduledAt)}</T>
            <T size={13} color={colors.muted}>
              {b.serviceName ?? "استشارة / فحص عام"} · {b.animalType} ({b.animalCount}){b.homeVisit ? " · زيارة منزلية" : ""}
            </T>
            {b.providerNote && <T size={13}>ملاحظة العيادة: {b.providerNote}</T>}
            {(b.status === "pending" || b.status === "confirmed") && <Button title="إلغاء الموعد" variant="ghost" small onPress={() => cancel.run(b.id)} />}
          </Card>
        ))
      )}
    </Screen>
  );
}
