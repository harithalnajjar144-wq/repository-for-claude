import { useState } from "react";
import { Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Booking } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Input, Loading, Row, Screen, T } from "@/components/ui";

export default function BusinessBookings() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["business-bookings"], queryFn: () => api<Booking[]>("/me/business/bookings"), refetchInterval: 60_000 });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const update = useAction((id: number, status: string) => api(`/bookings/${id}/status`, { body: { status, note: notes[id] } }), {
    success: "تم التحديث وإشعار المربي",
    invalidate: [["business-bookings"]],
  });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="📅" title="لا توجد حجوزات بعد" />
      ) : (
        q.data.map((b) => (
          <Card key={b.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T w="semibold">{b.customer?.name}</T>
              <Badge label={meta?.labels.bookingStatus[b.status] ?? b.status} tone={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "gray"} />
            </Row>
            <T>📅 {dateTime(b.scheduledAt)}</T>
            <T size={13} color={colors.muted}>
              {b.serviceName ?? "استشارة / فحص عام"} · {b.animalType} ({b.animalCount}){b.homeVisit ? " · زيارة منزلية" : ""}
            </T>
            {b.notes && <T size={13}>«{b.notes}»</T>}
            {b.customer?.phone && <Button title={`📞 ${b.customer.phone}`} variant="ghost" small onPress={() => Linking.openURL(`tel:${b.customer!.phone}`)} />}
            {(b.status === "pending" || b.status === "confirmed") && (
              <>
                <Input placeholder="ملاحظة للمربي (اختياري)" value={notes[b.id] ?? ""} onChangeText={(t) => setNotes((n) => ({ ...n, [b.id]: t }))} />
                <Row>
                  {b.status === "pending" && <Button title="تأكيد" small onPress={() => update.run(b.id, "confirmed")} style={{ flex: 1 }} />}
                  {b.status === "confirmed" && <Button title="تم" small onPress={() => update.run(b.id, "completed")} style={{ flex: 1 }} />}
                  <Button title={b.status === "pending" ? "رفض" : "إلغاء"} variant="outline" small onPress={() => update.run(b.id, b.status === "pending" ? "rejected" : "cancelled")} style={{ flex: 1 }} />
                </Row>
              </>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
