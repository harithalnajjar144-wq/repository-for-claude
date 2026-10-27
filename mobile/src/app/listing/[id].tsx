import { ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ageLabel, dateOnly, dateTime, iqd, num } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { ListingDetail } from "@/lib/types";
import { ListingCard } from "@/components/cards";
import { ContactButtons } from "@/components/ContactButtons";
import { Gallery } from "@/components/Gallery";
import { ReportButton } from "@/components/ReportButton";
import { Badge, Button, Card, ErrorView, Loading, Notice, Row, SectionTitle, T, Verified } from "@/components/ui";

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn } = useAuth();
  const { meta, category, city, icon } = useLabels();
  const q = useQuery({ queryKey: ["listing", id], queryFn: () => api<ListingDetail>(`/listings/${id}`) });
  const inv = [["listing", id], ["listings"], ["my-listings"], ["home"]];
  const fav = useAction((on: boolean) => api(`/listings/${id}/favorite`, { method: on ? "PUT" : "DELETE" }), { invalidate: [["listing", id], ["favorites"]] });
  const status = useAction((s: string) => api(`/listings/${id}/status`, { body: { status: s } }), { success: "تم التحديث", invalidate: inv });
  const feature = useAction(() => api(`/listings/${id}/feature`, { method: "POST" }), {
    success: "⭐ تم تمييز الإعلان لمدة 7 أيام",
    invalidate: [...inv, ["me"]],
    confirm: `سيتم خصم ${iqd(meta?.settings.featuredListingPrice)} من محفظتك لتمييز الإعلان 7 أيام. متابعة؟`,
  });
  const remove = useAction(() => api(`/listings/${id}/status`, { body: { status: "removed" } }), {
    success: "تم حذف الإعلان",
    invalidate: inv,
    confirm: "حذف الإعلان نهائياً؟",
    danger: true,
    onDone: () => router.back(),
  });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  const { listing: l, seller, isOwner, isFavorite, similar } = q.data;
  const featured = l.featuredUntil && new Date(l.featuredUntil) > new Date();
  const facts: [string, string | null][] = [
    ["النوع", `${icon(l.category)} ${category(l.category)}`],
    ["السلالة", l.breed],
    ["العدد", num(l.quantity)],
    ["العمر", ageLabel(l.ageMonths)],
    ["الجنس", l.gender !== "unknown" ? (meta?.labels.genders[l.gender] ?? null) : null],
    ["الوزن", l.weightKg ? `${l.weightKg} كغم` : null],
    ["الموقع", `${city(l.city)}${l.area ? ` - ${l.area}` : ""}`],
    ["تاريخ النشر", dateTime(l.createdAt)],
    ["المشاهدات", num(l.views)],
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: category(l.category) }} />
      <Gallery images={l.images} category={l.category} />
      <View style={{ padding: 16, gap: 14 }}>
        {l.status !== "active" && <Notice>{l.status === "sold" ? "تم بيع هذا الإعلان." : "هذا الإعلان غير ظاهر للعامة."}</Notice>}
        <Card style={{ gap: 8 }}>
          <Row wrap gap={6}>
            {l.type === "wanted" ? <Badge label="طلب شراء" tone="blue" /> : <Badge label="للبيع" tone="green" />}
            {featured && <Badge label="★ مميز" tone="amber" />}
            {l.negotiable && <Badge label="قابل للتفاوض" tone="earth" />}
          </Row>
          <T w="bold" size={20}>
            {l.title}
          </T>
          <T w="bold" size={24} color={colors.brand700}>
            {iqd(l.price)}
          </T>
          {l.price && l.quantity > 1 ? (
            <T size={13} color={colors.muted}>
              ≈ {iqd(Math.round(l.price / l.quantity))} للرأس
            </T>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={{ width: "48%", backgroundColor: colors.earth50, borderRadius: 10, padding: 8 }}>
                  <T size={11} color={colors.muted}>
                    {k}
                  </T>
                  <T w="medium" size={14}>
                    {v}
                  </T>
                </View>
              ))}
          </View>
          <T w="semibold" style={{ marginTop: 6 }}>
            الوصف
          </T>
          <T color={colors.ink} style={{ lineHeight: 26 }}>
            {l.description}
          </T>
        </Card>

        {isOwner ? (
          <Card style={{ gap: 8 }}>
            <T w="semibold">إدارة الإعلان</T>
            <Button title="✏️ تعديل" variant="outline" onPress={() => router.push({ pathname: "/listing/edit/[id]", params: { id: String(l.id) } })} />
            <Row>
              {l.status === "active" ? (
                <>
                  <Button title="تم البيع" variant="outline" style={{ flex: 1 }} onPress={() => status.run("sold")} loading={status.busy} />
                  <Button title="إخفاء" variant="outline" style={{ flex: 1 }} onPress={() => status.run("hidden")} />
                </>
              ) : (
                <Button title="إعادة النشر" variant="outline" style={{ flex: 1 }} onPress={() => status.run("active")} loading={status.busy} />
              )}
            </Row>
            {l.status === "active" && (
              <Button title={`★ تمييز 7 أيام (${iqd(meta?.settings.featuredListingPrice)})`} variant="earth" onPress={() => feature.run()} loading={feature.busy} />
            )}
            {featured && (
              <T size={12} color={colors.muted}>
                مميز حتى {dateOnly(l.featuredUntil)}
              </T>
            )}
            <Button title="حذف الإعلان" variant="ghost" onPress={() => remove.run()} />
          </Card>
        ) : (
          <Card style={{ gap: 10 }}>
            <Row>
              <View style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" }}>
                <T w="bold" color={colors.brand700}>
                  {seller.name.slice(0, 1)}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <Row gap={6}>
                  <T w="semibold">{seller.name}</T>
                  <Verified status={seller.verificationStatus} />
                </Row>
                <T size={12} color={colors.muted}>
                  {meta?.labels.roles[seller.role]} · {city(seller.city)} · عضو منذ {dateOnly(seller.createdAt)}
                </T>
              </View>
            </Row>
            {seller.verificationStatus !== "verified" && <Notice tone="amber">هذا الحساب غير موثق بعد. عاين الحيوان بنفسك ولا تحوّل أي مبلغ قبل الاستلام.</Notice>}
            {signedIn && seller.phone ? (
              <ContactButtons phone={seller.phone} whatsapp={seller.whatsapp} message={`السلام عليكم، بخصوص إعلانك على حلالي: ${l.title}`} />
            ) : (
              <Button title="سجّل الدخول لإظهار رقم البائع" onPress={() => router.push("/login")} />
            )}
            <Row>
              {signedIn && (
                <Button title={isFavorite ? "♥ في المفضلة" : "♡ أضف للمفضلة"} variant="outline" style={{ flex: 1 }} onPress={() => fav.run(!isFavorite)} loading={fav.busy} />
              )}
              <Button title="إعلانات البائع" variant="ghost" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/user/[id]", params: { id: String(seller.id) } })} />
            </Row>
          </Card>
        )}

        <Notice tone="green">نصيحة: عاين الحيوان قبل الدفع واطلب شهادة التطعيم أو افحصه عند طبيب بيطري.</Notice>
        {signedIn && !isOwner && <ReportButton targetType="listing" targetId={l.id} />}

        {similar.length > 0 && (
          <>
            <SectionTitle title="إعلانات مشابهة" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {similar.map((s) => (
                <ListingCard key={s.id} l={s} width={180} />
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </ScrollView>
  );
}
