import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { ListingCard } from "@/components/cards";
import { Empty, Loading, Screen } from "@/components/ui";

export default function Favorites() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => api<Listing[]>("/me/favorites") });
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="♡" title="لا توجد إعلانات في المفضلة" />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {q.data.map((l) => (
            <View key={l.id} style={{ width: "48.5%" }}>
              <ListingCard l={l} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
