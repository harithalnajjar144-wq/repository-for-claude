import { Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime, iqd } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Order } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Loading, Row, Screen, T } from "@/components/ui";

const NEXT: Record<string, [string, string][]> = {
  pending: [["confirmed", "تأكيد"], ["cancelled", "رفض"]],
  confirmed: [["ready", "جاهز"], ["delivered", "تم التسليم"], ["cancelled", "إلغاء"]],
  ready: [["delivered", "تم التسليم"], ["cancelled", "إلغاء"]],
};

export default function BusinessOrders() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["business-orders"], queryFn: () => api<Order[]>("/me/business/orders"), refetchInterval: 60_000 });
  const update = useAction((id: number, status: string) => api(`/orders/${id}/status`, { body: { status } }), {
    success: "تم التحديث وإشعار الزبون",
    invalidate: [["business-orders"], ["business"]],
  });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="🛒" title="لا توجد طلبات بعد" />
      ) : (
        q.data.map((o) => (
          <Card key={o.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T w="semibold">
                #{o.id} · {o.customer?.name}
              </T>
              <Badge label={meta?.labels.orderStatus[o.status] ?? o.status} tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "gray" : "amber"} />
            </Row>
            <T size={12} color={colors.faint}>
              {dateTime(o.createdAt)} · {o.fulfilment === "delivery" ? `توصيل إلى: ${o.address}` : "استلام من المحل"}
            </T>
            {o.items.map((i) => (
              <T key={i.id} size={13} color={colors.muted}>
                {i.quantity} × {i.name} — {iqd(i.unitPrice * i.quantity)}
              </T>
            ))}
            {o.notes && <T size={13}>«{o.notes}»</T>}
            <T w="semibold">المجموع: {iqd(o.total)}</T>
            <Button title={`📞 ${o.phone}`} variant="ghost" small onPress={() => Linking.openURL(`tel:${o.phone}`)} />
            {NEXT[o.status] && (
              <Row>
                {NEXT[o.status].map(([s, l]) => (
                  <Button key={s} title={l} small variant={s === "cancelled" ? "outline" : "primary"} style={{ flex: 1 }} onPress={() => update.run(o.id, s)} />
                ))}
              </Row>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}
