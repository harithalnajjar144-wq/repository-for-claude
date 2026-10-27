import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRaw } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import type { Auction } from "@/lib/types";
import { AuctionCard } from "@/components/cards";
import { ChipPicker, Empty, ErrorView, Loading, T } from "@/components/ui";

export default function AuctionsScreen() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"active" | "ended">("active");
  const q = useInfiniteQuery({
    queryKey: ["auctions", status],
    queryFn: ({ pageParam }) => apiRaw<Auction[]>("/auctions", { query: { status, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.data.length === 24 ? all.length + 1 : undefined),
    refetchInterval: 30_000,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const canCreate = user?.role === "trader" || user?.role === "admin";
  return (
    <View style={{ flex: 1, backgroundColor: colors.sand }}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => String(a.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListHeaderComponent={
            <View style={{ gap: 10, paddingBottom: 6 }}>
              <T color={colors.muted} size={13}>
                مزادات محمية بنظام التأمين المالي للحيوانات النادرة وذات القيمة العالية.
              </T>
              <ChipPicker
                options={[
                  { value: "active", label: "المباشرة والقادمة" },
                  { value: "ended", label: "المنتهية" },
                ]}
                value={status}
                onChange={setStatus}
              />
            </View>
          }
          ListEmptyComponent={<Empty icon="🔨" title={status === "active" ? "لا توجد مزادات نشطة حالياً" : "لا توجد مزادات منتهية"} />}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: "50%" }}>
              <AuctionCard a={item} />
            </View>
          )}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
        />
      )}
      {canCreate && (
        <Pressable
          onPress={() => router.push("/auction/new")}
          style={{ position: "absolute", bottom: 20, end: 20, backgroundColor: colors.earth500, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 12, elevation: 4 }}
        >
          <T color={colors.white} w="bold">
            + افتح مزاداً
          </T>
        </Pressable>
      )}
    </View>
  );
}
