import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, iqd } from "@/lib/format";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Auction } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Empty, Loading, Row, Screen, SectionTitle, T } from "@/components/ui";

type Mine = { bidding: (Auction & { deposit: { amount: number; status: string }; won: boolean })[]; selling: Auction[] };
const DEP: Record<string, string> = { held: "محجوز", released: "مُعاد", forfeited: "مُصادر" };

export default function MyAuctions() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["my-auctions"], queryFn: () => api<Mine>("/me/auctions") });
  const open = (id: number) => router.push({ pathname: "/auction/[id]", params: { id: String(id) } });
  const isTrader = user?.role === "trader" || user?.role === "admin";
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading || !q.data ? (
        <Loading full={false} />
      ) : (
        <>
          <SectionTitle title="مزايداتي" />
          {q.data.bidding.length === 0 ? (
            <Empty icon="🔨" title="لم تشارك في أي مزاد بعد">
              <Button title="تصفح المزادات" variant="outline" onPress={() => router.push("/(tabs)/auctions")} />
            </Empty>
          ) : (
            q.data.bidding.map((a) => (
              <Card key={a.id} onPress={() => open(a.id)} style={{ gap: 4 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T w="semibold" lines={1} style={{ flex: 1 }}>
                    {a.title}
                  </T>
                  {a.won ? <Badge label="🏆 فائز" tone="green" /> : a.winnerId ? <Badge label="لم تفز" /> : null}
                </Row>
                <T size={13} color={colors.muted}>
                  {meta?.labels.auctionStatus[a.status]} · {iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}
                </T>
                <T size={12} color={colors.faint}>
                  التأمين {iqd(a.deposit.amount)} ({DEP[a.deposit.status]}) · ينتهي {dateTime(a.endsAt)}
                </T>
              </Card>
            ))
          )}
          {(isTrader || q.data.selling.length > 0) && (
            <>
              <SectionTitle title="مزاداتي كبائع" />
              {isTrader && <Button title="+ مزاد جديد" variant="earth" onPress={() => router.push("/auction/new")} />}
              {q.data.selling.map((a) => (
                <Card key={a.id} onPress={() => open(a.id)} style={{ gap: 4 }}>
                  <T w="semibold" lines={1}>
                    {a.title}
                  </T>
                  <T size={13} color={colors.muted}>
                    {meta?.labels.auctionStatus[a.status]} · {a.bidCount} مزايدة · {iqd(a.winningBid ?? a.currentPrice ?? a.startPrice)}
                  </T>
                  {a.status === "ended" && (
                    <T size={12} color={colors.earth700}>
                      أكّد التسليم من صفحة المزاد
                    </T>
                  )}
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
