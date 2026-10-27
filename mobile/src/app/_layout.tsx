import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { AuthProvider } from "@/lib/auth";
import { appRouteFor } from "@/lib/links";
import { colors, fonts } from "@/lib/theme";
import { FeedbackProvider } from "@/components/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Arabic-only app: right-to-left everywhere (the native setting comes from app.json → expo-localization).
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.dir = "rtl";
  document.documentElement.lang = "ar";
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (link: unknown) => router.push(appRouteFor(typeof link === "string" ? link : null));
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) open(r.notification.request.content.data?.link);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.link));
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const [loaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  useNotificationTaps();
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerTintColor: colors.brand700,
                headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
                headerStyle: { backgroundColor: colors.white },
                headerBackButtonDisplayMode: "minimal",
                contentStyle: { backgroundColor: colors.sand },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ title: "تسجيل الدخول", presentation: "modal" }} />
              <Stack.Screen name="register" options={{ title: "حساب جديد", presentation: "modal" }} />
              <Stack.Screen name="forgot-password" options={{ title: "استعادة كلمة المرور" }} />
              <Stack.Screen name="listing/[id]" options={{ title: "تفاصيل الإعلان" }} />
              <Stack.Screen name="listing/new" options={{ title: "إعلان جديد" }} />
              <Stack.Screen name="listing/edit/[id]" options={{ title: "تعديل الإعلان" }} />
              <Stack.Screen name="auction/[id]" options={{ title: "المزاد" }} />
              <Stack.Screen name="auction/new" options={{ title: "مزاد جديد" }} />
              <Stack.Screen name="provider/[id]" options={{ title: "" }} />
              <Stack.Screen name="user/[id]" options={{ title: "ملف البائع" }} />
              <Stack.Screen name="account/listings" options={{ title: "إعلاناتي" }} />
              <Stack.Screen name="account/favorites" options={{ title: "المفضلة" }} />
              <Stack.Screen name="account/auctions" options={{ title: "مزاداتي ومزايداتي" }} />
              <Stack.Screen name="account/bookings" options={{ title: "حجوزاتي البيطرية" }} />
              <Stack.Screen name="account/orders" options={{ title: "طلباتي" }} />
              <Stack.Screen name="account/wallet" options={{ title: "المحفظة" }} />
              <Stack.Screen name="account/topup" options={{ title: "شحن المحفظة" }} />
              <Stack.Screen name="account/subscription" options={{ title: "الباقة" }} />
              <Stack.Screen name="account/notifications" options={{ title: "الإشعارات" }} />
              <Stack.Screen name="account/profile" options={{ title: "الملف الشخصي" }} />
              <Stack.Screen name="account/verification" options={{ title: "توثيق الحساب" }} />
              <Stack.Screen name="account/password" options={{ title: "كلمة المرور" }} />
              <Stack.Screen name="business/index" options={{ title: "نشاطي التجاري" }} />
              <Stack.Screen name="business/services" options={{ title: "الخدمات والأسعار" }} />
              <Stack.Screen name="business/products" options={{ title: "المنتجات" }} />
              <Stack.Screen name="business/product" options={{ title: "منتج" }} />
              <Stack.Screen name="business/bookings" options={{ title: "حجوزات العيادة" }} />
              <Stack.Screen name="business/orders" options={{ title: "طلبات المحل" }} />
            </Stack>
          </AuthProvider>
        </FeedbackProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
