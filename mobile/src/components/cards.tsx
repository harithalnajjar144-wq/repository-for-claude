import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { fileUrl } from "@/lib/api";
import { ageLabel, iqd, timeAgo } from "@/lib/format";
import { useLabels } from "@/lib/meta";
import { colors, radius } from "@/lib/theme";
import type { Auction, Listing, Provider } from "@/lib/types";
import { Badge, Row, T, Verified, styles } from "./ui";
import { Countdown } from "./Countdown";

export function Thumb({ src, category, height = 130, rounded = true }: { src?: string; category?: string; height?: number; rounded?: boolean }) {
  const { icon } = useLabels();
  const r = rounded ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg } : {};
  if (src) return <Image alt="" source={{ uri: fileUrl(src) }} style={[{ height, width: "100%", backgroundColor: colors.earth100 }, r]} contentFit="cover" transition={150} />;
  return (
    <View style={[{ height, width: "100%", backgroundColor: colors.earth100, alignItems: "center", justifyContent: "center" }, r]}>
      <T size={height / 2.6}>{icon(category)}</T>
    </View>
  );
}

export function ListingCard({ l, width }: { l: Listing; width?: number }) {
  const { category, city } = useLabels();
  const featured = l.featuredUntil && new Date(l.featuredUntil) > new Date();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(l.id) } })}
      style={({ pressed }) => [styles.card, { padding: 0, overflow: "hidden", width }, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Thumb src={l.images[0]} category={l.category} />
        <Row style={{ position: "absolute", top: 8, start: 8 }} gap={4}>
          {l.type === "wanted" && <Badge label="مطلوب" tone="blue" />}
          {featured && <Badge label="★ مميز" tone="amber" />}
        </Row>
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <T size={12} color={colors.muted} lines={1}>
          {category(l.category)}
          {l.breed ? ` · ${l.breed}` : ""}
        </T>
        <T w="semibold" size={14} lines={2} style={{ minHeight: 44 }}>
          {l.title}
        </T>
        <T size={12} color={colors.muted} lines={1}>
          {[l.quantity > 1 ? `العدد ${l.quantity}` : null, ageLabel(l.ageMonths)].filter(Boolean).join(" · ") || " "}
        </T>
        <T w="bold" color={colors.brand700} size={15}>
          {iqd(l.price)}
        </T>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={11} color={colors.faint}>
            📍 {city(l.city)}
          </T>
          <T size={11} color={colors.faint}>
            {timeAgo(l.createdAt)}
          </T>
        </Row>
        {l.seller && (
          <Row gap={4}>
            <T size={11} color={colors.muted} lines={1} style={{ flexShrink: 1 }}>
              {l.seller.name}
            </T>
            <Verified status={l.seller.verificationStatus} />
          </Row>
        )}
      </View>
    </Pressable>
  );
}

export function auctionPhase(a: Pick<Auction, "status" | "startsAt" | "endsAt">) {
  if (a.status === "scheduled" || a.status === "live") {
    const now = Date.now();
    if (now >= new Date(a.endsAt).getTime()) return "closing";
    if (now >= new Date(a.startsAt).getTime()) return "live";
    return "scheduled";
  }
  return a.status;
}

export function AuctionBadge({ a }: { a: Pick<Auction, "status" | "startsAt" | "endsAt"> }) {
  const p = auctionPhase(a);
  if (p === "live") return <Badge label="● مباشر" tone="red" />;
  if (p === "scheduled") return <Badge label="يبدأ قريباً" tone="blue" />;
  const labels: Record<string, [string, "green" | "gray"]> = {
    closing: ["يُغلق الآن", "gray"],
    ended: ["منتهي - بانتظار التسليم", "green"],
    completed: ["مكتمل", "green"],
    unsold: ["بدون مزايدات", "gray"],
    cancelled: ["ملغي", "gray"],
  };
  const [label, tone] = labels[p] ?? [p, "gray"];
  return <Badge label={label} tone={tone} />;
}

export function AuctionCard({ a, width }: { a: Auction; width?: number }) {
  const { category, city } = useLabels();
  const phase = auctionPhase(a);
  const price = a.winningBid ?? a.currentPrice ?? a.startPrice;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/auction/[id]", params: { id: String(a.id) } })}
      style={({ pressed }) => [styles.card, { padding: 0, overflow: "hidden", width }, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Thumb src={a.images[0]} category={a.category} />
        <View style={{ position: "absolute", top: 8, start: 8 }}>
          <AuctionBadge a={a} />
        </View>
        {(phase === "live" || phase === "scheduled") && (
          <View style={{ position: "absolute", bottom: 0, start: 0, end: 0, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 3 }}>
            <Row gap={4}>
              <T size={12} color={colors.white}>
                {phase === "live" ? "ينتهي خلال" : "يبدأ خلال"}
              </T>
              <Countdown to={phase === "live" ? a.endsAt : a.startsAt} compact color={colors.white} />
            </Row>
          </View>
        )}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <T size={12} color={colors.muted} lines={1}>
          {category(a.category)}
          {a.breed ? ` · ${a.breed}` : ""}
        </T>
        <T w="semibold" size={14} lines={2} style={{ minHeight: 44 }}>
          {a.title}
        </T>
        <View style={{ backgroundColor: colors.earth50, borderRadius: 8, padding: 6 }}>
          <T size={11} color={colors.muted}>
            {a.currentPrice ? "أعلى مزايدة" : "سعر البداية"}
          </T>
          <T w="bold" color={colors.earth700}>
            {iqd(price)}
          </T>
        </View>
        <Row style={{ justifyContent: "space-between" }}>
          <T size={11} color={colors.faint}>
            📍 {city(a.city)}
          </T>
          <T size={11} color={colors.faint}>
            {a.bidCount} مزايدة
          </T>
        </Row>
      </View>
    </Pressable>
  );
}

export function ProviderCard({ p }: { p: Provider }) {
  const { city } = useLabels();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/provider/[id]", params: { id: String(p.id) } })}
      style={({ pressed }) => [styles.card, { flexDirection: "row", gap: 12 }, pressed && { opacity: 0.85 }]}
    >
      <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: colors.brand50, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {p.logo ? <Image alt="" source={{ uri: fileUrl(p.logo) }} style={{ width: 60, height: 60 }} /> : <T size={28}>{p.kind === "vet" ? "🩺" : "🏪"}</T>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6}>
          <T w="semibold" lines={1} style={{ flexShrink: 1 }}>
            {p.businessName}
          </T>
          <Verified status={p.verificationStatus} />
        </Row>
        <T size={12} color={colors.muted} lines={1}>
          📍 {city(p.city)}
          {p.address ? ` · ${p.address}` : ""}
        </T>
        {p.description ? (
          <T size={13} color={colors.muted} lines={2}>
            {p.description}
          </T>
        ) : null}
        <Row wrap gap={4}>
          {p.homeVisits && <Badge label="زيارات منزلية" tone="green" />}
          {p.delivery && <Badge label="توصيل" tone="green" />}
          {p.specialties.slice(0, 2).map((s) => (
            <Badge key={s} label={s} tone="earth" />
          ))}
        </Row>
      </View>
    </Pressable>
  );
}
