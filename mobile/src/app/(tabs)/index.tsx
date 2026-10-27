import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { num } from "@/lib/format";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Auction, Listing, Provider } from "@/lib/types";
import { AuctionCard, ListingCard, ProviderCard } from "@/components/cards";
import { Button, ErrorView, Loading, Row, SectionTitle, T } from "@/components/ui";
import { Image } from "expo-image";

type Home = {
  stats: { listings: number; auctions: number; verified: number; providers: number };
  liveAuctions: Auction[];
  latestListings: Listing[];
  vets: Provider[];
  shops: Provider[];
  ad: { id: number; title: string; subtitle: string | null; imageUrl: string | null; clickUrl: string } | null;
};

export default function HomeScreen() {
  const { signedIn, user } = useAuth();
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["home"], queryFn: () => api<Home>("/home") });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  const h = q.data;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.brand900 }}>
      <ScrollView style={{ backgroundColor: colors.sand }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.white} />}>
        {/* Header */}
        <View style={{ backgroundColor: colors.brand900, padding: 18, paddingBottom: 26, gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <T w="bold" size={26} color={colors.white}>
                حلالي
              </T>
              <T size={13} color={colors.earth200}>
                {user ? `أهلاً ${user.name.split(" ")[0]} 👋` : "سوق المواشي الرقمي في العراق"}
              </T>
            </View>
            {!signedIn && <Button title="دخول" small variant="earth" onPress={() => router.push("/login")} />}
          </Row>
          <Pressable
            onPress={() => router.push("/(tabs)/market")}
            style={{ backgroundColor: colors.white, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}
          >
            <T color={colors.faint}>🔍 ابحث عن سلالة… عواسي، كرادي، شامي</T>
          </Pressable>
          <Row gap={8}>
            {[
              [num(h.stats.listings), "إعلان نشط"],
              [num(h.stats.auctions), "مزاد"],
              [num(h.stats.verified), "حساب موثق"],
              [num(h.stats.providers), "طبيب ومحل"],
            ].map(([v, l]) => (
              <View key={l} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 8, alignItems: "center" }}>
                <T w="bold" size={18} color={colors.white}>
                  {v}
                </T>
                <T size={10} color={colors.earth200}>
                  {l}
                </T>
              </View>
            ))}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {meta?.animalCategories.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => router.push({ pathname: "/(tabs)/market", params: { category: c.key } })}
                style={{ backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" }}
              >
                <T size={24}>{c.icon}</T>
                <T size={12} w="medium">
                  {c.label}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          {h.ad && (
            <Pressable onPress={() => Linking.openURL(fileUrl(h.ad!.clickUrl)!)} style={{ borderRadius: 16, overflow: "hidden", backgroundColor: colors.earth500, padding: 16 }}>
              {h.ad.imageUrl && <Image alt="" source={{ uri: fileUrl(h.ad.imageUrl) }} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: 0.3 }} />}
              <T size={11} color={colors.earth100}>
                إعلان
              </T>
              <T w="bold" size={16} color={colors.white}>
                {h.ad.title}
              </T>
              {h.ad.subtitle && (
                <T size={13} color={colors.white}>
                  {h.ad.subtitle}
                </T>
              )}
            </Pressable>
          )}

          <SectionTitle title="🔨 المزادات المباشرة" action="الكل" onAction={() => router.push("/(tabs)/auctions")} />
          {h.liveAuctions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {h.liveAuctions.map((a) => (
                <AuctionCard key={a.id} a={a} width={190} />
              ))}
            </ScrollView>
          ) : (
            <T color={colors.muted}>لا توجد مزادات حالياً.</T>
          )}

          <SectionTitle title="أحدث الإعلانات" action="السوق" onAction={() => router.push("/(tabs)/market")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {h.latestListings.map((l) => (
              <View key={l.id} style={{ width: "48.5%" }}>
                <ListingCard l={l} />
              </View>
            ))}
          </View>

          <SectionTitle title="🩺 أطباء بيطريون" action="الكل" onAction={() => router.push({ pathname: "/(tabs)/services", params: { kind: "vet" } })} />
          {h.vets.slice(0, 3).map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
          <SectionTitle title="🏪 أعلاف ومستلزمات" action="الكل" onAction={() => router.push({ pathname: "/(tabs)/services", params: { kind: "shop" } })} />
          {h.shops.slice(0, 3).map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
