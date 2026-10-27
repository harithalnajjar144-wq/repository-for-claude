import { Tabs } from "expo-router/js-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={typeof color === "string" ? color : undefined} size={size} />;
  };

export default function TabsLayout() {
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
        headerStyle: { backgroundColor: colors.white },
        sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", headerShown: false, tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="market" options={{ title: "السوق", tabBarIcon: icon("storefront-outline") }} />
      <Tabs.Screen name="auctions" options={{ title: "المزادات", tabBarIcon: icon("hammer-outline") }} />
      <Tabs.Screen name="services" options={{ title: "أطباء ومحلات", tabBarIcon: icon("medkit-outline") }} />
      <Tabs.Screen
        name="account"
        options={{
          title: "حسابي",
          tabBarIcon: icon("person-circle-outline"),
          tabBarBadge: me?.unreadNotifications ? me.unreadNotifications : undefined,
        }}
      />
    </Tabs>
  );
}
