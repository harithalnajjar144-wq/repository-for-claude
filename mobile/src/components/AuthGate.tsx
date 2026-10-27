import type { ReactNode } from "react";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { Button, Loading, Screen, T } from "./ui";

/** Shows a sign-in prompt instead of `children` when signed out. */
export function AuthGate({ children, message = "سجّل الدخول للمتابعة." }: { children: ReactNode; message?: string }) {
  const { ready, signedIn, me } = useAuth();
  if (!ready || (signedIn && !me)) return <Loading />;
  if (!signedIn)
    return (
      <Screen>
        <T size={44} center>
          🐑
        </T>
        <T w="semibold" size={17} center>
          {message}
        </T>
        <T center color={colors.muted}>
          أنشئ حساباً مجانياً لتنشر إعلاناتك وتزايد وتحجز عند الأطباء.
        </T>
        <Button title="تسجيل الدخول" onPress={() => router.push("/login")} />
        <Button title="إنشاء حساب جديد" variant="outline" onPress={() => router.push("/register")} />
      </Screen>
    );
  return <>{children}</>;
}
