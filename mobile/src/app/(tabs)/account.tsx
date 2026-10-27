import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/auth";
import { dateOnly, iqd } from "@/lib/format";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Notice, Row, Screen, T, Verified, useFeedback } from "@/components/ui";

type Item = { href: Href; label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number };

function Menu({ items }: { items: Item[] }) {
  return (
    <Card style={{ padding: 0 }}>
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          onPress={() => router.push(it.href)}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
            i > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
            pressed && { backgroundColor: colors.earth50 },
          ]}
        >
          <Ionicons name={it.icon} size={21} color={colors.brand600} />
          <T style={{ flex: 1 }}>{it.label}</T>
          {!!it.badge && <Badge label={String(it.badge)} tone="red" />}
          <Ionicons name="chevron-back" size={18} color={colors.faint} />
        </Pressable>
      ))}
    </Card>
  );
}

export default function AccountScreen() {
  return (
    <AuthGate message="سجّل الدخول لإدارة حسابك.">
      <AccountContent />
    </AuthGate>
  );
}

function AccountContent() {
  const { me, refreshMe, signOut } = useAuth();
  const { data: meta } = useMeta();
  const { confirm } = useFeedback();
  if (!me) return null;
  const u = me.user;
  const isBiz = u.role === "vet" || u.role === "shop";
  return (
    <Screen onRefresh={refreshMe} refreshing={false}>
      <Card style={{ gap: 10 }}>
        <Row>
          <View style={{ width: 52, height: 52, borderRadius: 99, backgroundColor: colors.brand100, alignItems: "center", justifyContent: "center" }}>
            <T w="bold" size={22} color={colors.brand700}>
              {u.name.slice(0, 1)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <T w="bold" size={17}>
                {u.name}
              </T>
              <Verified status={u.verificationStatus} />
            </Row>
            <T size={13} color={colors.muted}>
              {meta?.labels.roles[u.role] ?? u.role} · {u.phone}
            </T>
          </View>
        </Row>
        <Row>
          <Pressable onPress={() => router.push("/account/wallet")} style={{ flex: 1, backgroundColor: colors.brand50, borderRadius: 12, padding: 10 }}>
            <T size={12} color={colors.muted}>
              رصيد المحفظة
            </T>
            <T w="bold" size={17} color={u.walletBalance < 0 ? colors.red : colors.brand700}>
              {iqd(u.walletBalance)}
            </T>
          </Pressable>
          <Pressable onPress={() => router.push("/account/subscription")} style={{ flex: 1, backgroundColor: colors.earth50, borderRadius: 12, padding: 10 }}>
            <T size={12} color={colors.muted}>
              الباقة
            </T>
            <T w="bold" size={15} color={colors.earth700}>
              {me.subscription ? me.subscription.plan.name : "مجانية"}
            </T>
            {me.subscription && (
              <T size={11} color={colors.muted}>
                حتى {dateOnly(me.subscription.endsAt)}
              </T>
            )}
          </Pressable>
        </Row>
      </Card>

      {u.verificationStatus !== "verified" && (
        <Pressable onPress={() => router.push("/account/verification")}>
          <Notice tone={u.verificationStatus === "rejected" ? "red" : u.verificationStatus === "pending" ? "blue" : "earth"}>
            {u.verificationStatus === "pending"
              ? "طلب التوثيق قيد المراجعة."
              : u.verificationStatus === "rejected"
                ? "تم رفض طلب التوثيق. اضغط لإعادة التقديم."
                : "حسابك غير موثق. وثّق حسابك لترفع ثقة المشترين وتشارك في المزادات ←"}
          </Notice>
        </Pressable>
      )}
      {u.walletBalance < 0 && <Notice tone="red">{`عليك مستحقات عمولة بقيمة ${iqd(-u.walletBalance)}. اشحن المحفظة لفتح مزادات جديدة.`}</Notice>}

      {isBiz && (
        <Menu
          items={
            u.role === "vet"
              ? [
                  { href: "/business", label: "ملف العيادة", icon: "medkit-outline" },
                  { href: "/business/services", label: "الخدمات والأسعار", icon: "list-outline" },
                  { href: "/business/bookings", label: "حجوزات العيادة", icon: "calendar-outline" },
                ]
              : [
                  { href: "/business", label: "ملف المحل", icon: "storefront-outline" },
                  { href: "/business/products", label: "المنتجات", icon: "cube-outline" },
                  { href: "/business/orders", label: "طلبات المحل", icon: "receipt-outline" },
                ]
          }
        />
      )}

      <Menu
        items={[
          { href: "/account/notifications", label: "الإشعارات", icon: "notifications-outline", badge: me.unreadNotifications },
          { href: "/account/listings", label: "إعلاناتي", icon: "pricetags-outline" },
          { href: "/account/auctions", label: "مزاداتي ومزايداتي", icon: "hammer-outline" },
          { href: "/account/favorites", label: "المفضلة", icon: "heart-outline" },
          { href: "/account/bookings", label: "حجوزاتي البيطرية", icon: "calendar-outline" },
          { href: "/account/orders", label: "طلباتي من المحلات", icon: "bag-handle-outline" },
        ]}
      />
      <Menu
        items={[
          { href: "/account/wallet", label: "المحفظة والشحن", icon: "wallet-outline" },
          { href: "/account/subscription", label: "الباقة والاشتراك", icon: "star-outline" },
          { href: "/account/profile", label: "الملف الشخصي", icon: "person-outline" },
          { href: "/account/verification", label: "توثيق الحساب", icon: "shield-checkmark-outline" },
          { href: "/account/password", label: "تغيير كلمة المرور", icon: "key-outline" },
        ]}
      />
      <Button
        title="تسجيل الخروج"
        variant="outline"
        onPress={async () => {
          if (await confirm("هل تريد تسجيل الخروج؟", { okText: "خروج", danger: true })) {
            await signOut();
            router.replace("/");
          }
        }}
      />
      <T size={12} color={colors.faint} center>
        حلالي · سوق المواشي الرقمي
      </T>
    </Screen>
  );
}
