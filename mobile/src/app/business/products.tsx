import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { iqd } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Product } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Button, Card, Empty, Loading, Row, Screen, T } from "@/components/ui";

export default function Products() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { productCategory } = useLabels();
  const q = useQuery({ queryKey: ["business"], queryFn: () => api<{ products: Product[] }>("/me/business") });
  const del = useAction((id: number) => api(`/me/business/products/${id}`, { method: "DELETE" }), {
    success: "تم الحذف",
    invalidate: [["business"]],
    confirm: "حذف المنتج؟",
    danger: true,
  });
  if (q.isLoading) return <Loading />;
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Button title="+ منتج جديد" onPress={() => router.push("/business/product")} />
      {!q.data?.products.length && <Empty icon="📦" title="أضف منتجاتك ليتمكن الزبائن من الطلب مباشرة" />}
      {q.data?.products.map((p) => (
        <Card key={p.id} style={{ gap: 4 }}>
          <T w="semibold">{p.name}</T>
          <T size={13} color={colors.muted}>
            {productCategory(p.category)} · {iqd(p.price)}
            {p.unit ? ` / ${p.unit}` : ""}
          </T>
          <T size={13} color={p.stock === 0 ? colors.red : colors.muted}>
            المخزون: {p.stock}
          </T>
          <Row>
            <Button title="تعديل" variant="outline" small onPress={() => router.push({ pathname: "/business/product", params: { id: String(p.id) } })} />
            <Button title="حذف" variant="ghost" small onPress={() => del.run(p.id)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
