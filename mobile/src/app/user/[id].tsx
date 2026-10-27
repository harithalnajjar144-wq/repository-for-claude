import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateOnly } from "@/lib/format";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Auction, Listing, Role, Verification } from "@/lib/types";
import { AuctionCard, ListingCard } from "@/components/cards";
import { Card, Empty, ErrorView, Loading, Row, Screen, SectionTitle, T, Verified } from "@/components/ui";

type Profile = {
  user: { id: number; name: string; role: Role; city: string; bio: string | null; verificationStatus: Verification; createdAt: string };
  listings: Listing[];
  auctions: Auction[];
};

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meta, city } = useLabels();
  const q = useQuery({ queryKey: ["user", id], queryFn: () => api<Profile>(`/users/${id}`) });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  const { user: u, listings, auctions } = q.data;
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Card style={{ gap: 4 }}>
        <Row gap={6}>
          <T w="bold" size={19}>
            {u.name}
          </T>
          <Verified status={u.verificationStatus} />
        </Row>
        <T size={13} color={colors.muted}>
          {meta?.labels.roles[u.role]} · {city(u.city)} · عضو منذ {dateOnly(u.createdAt)}
        </T>
        {u.bio && <T>{u.bio}</T>}
      </Card>
      {auctions.length > 0 && (
        <>
          <SectionTitle title="مزادات نشطة" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {auctions.map((a) => (
              <View key={a.id} style={{ width: "48.5%" }}>
                <AuctionCard a={a} />
              </View>
            ))}
          </View>
        </>
      )}
      <SectionTitle title={`الإعلانات (${listings.length})`} />
      {listings.length === 0 ? (
        <Empty title="لا توجد إعلانات نشطة" />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {listings.map((l) => (
            <View key={l.id} style={{ width: "48.5%" }}>
              <ListingCard l={l} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
