import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime, iqd } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Order } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Loading, Row, Screen, T } from "@/components/ui";

export default function MyOrders() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => api<Order[]>("/me/orders") });
  const cancel = useAction((id: number) => api(`/orders/${id}/status`, { body: { status: "cancelled" } }), {
    success: "تم إلغاء الطلب",
    invalidate: [["my-orders"]],
    confirm: "إلغاء الطلب؟",
    danger: true,
  });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="🛒" title="لا توجد طلبات" />
      ) : (
        q.data.map((o) => (
          <Card key={o.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T w="semibold">
                {o.provider?.businessName} · #{o.id}
              </T>
              <Badge label={meta?.labels.orderStatus[o.status] ?? o.status} tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "gray" : "amber"} />
            </Row>
            <T size={12} color={colors.faint}>
              {dateTime(o.createdAt)} · {o.fulfilment === "delivery" ? "توصيل" : "استلام من المحل"}
            </T>
            {o.items.map((i) => (
              <T key={i.id} size={13} color={colors.muted}>
                {i.quantity} × {i.name} — {iqd(i.unitPrice * i.quantity)}
              </T>
            ))}
            <T w="semibold">المجموع: {iqd(o.total)}</T>
            {o.status === "pending" && <Button title="إلغاء الطلب" variant="ghost" small onPress={() => cancel.run(o.id)} />}
          </Card>
        ))
      )}
    </Screen>
  );
}
