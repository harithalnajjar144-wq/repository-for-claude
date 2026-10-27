import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateOnly, iqd, num } from "@/lib/format";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Listing } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Loading, Row, Screen, T } from "@/components/ui";

const STATUS: Record<string, [string, "green" | "earth" | "gray"]> = { active: ["نشط", "green"], sold: ["مباع", "earth"], hidden: ["مخفي", "gray"] };

export default function MyListings() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { category } = useLabels();
  const q = useQuery({ queryKey: ["my-listings"], queryFn: () => api<Listing[]>("/me/listings") });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Button title="+ إعلان جديد" onPress={() => router.push("/listing/new")} />
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty title="لم تنشر أي إعلان بعد" />
      ) : (
        q.data.map((l) => (
          <Card key={l.id} onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(l.id) } })} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T w="semibold" style={{ flex: 1 }} lines={1}>
                {l.title}
              </T>
              <Badge label={STATUS[l.status]?.[0] ?? l.status} tone={STATUS[l.status]?.[1] ?? "gray"} />
            </Row>
            <T size={13} color={colors.muted}>
              {category(l.category)} · {iqd(l.price)}
            </T>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T size={12} color={colors.faint}>
                👁 {num(l.views)} مشاهدة
              </T>
              <T size={12} color={colors.faint}>
                {dateOnly(l.createdAt)}
              </T>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
