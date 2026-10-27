import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { deviceName, useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { User } from "@/lib/types";
import { Button, Input, Screen, T } from "@/components/ui";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { data: meta } = useMeta();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const login = useAction(
    async () => {
      const s = await api<{ token: string; user: User }>("/auth/login", { body: { phone, password, deviceName: deviceName() } });
      await signIn(s);
      return s;
    },
    { success: (s) => `أهلاً ${s.user.name.split(" ")[0]} 👋`, onDone: () => (router.canGoBack() ? router.back() : router.replace("/")) },
  );
  return (
    <Screen>
      <T w="bold" size={24}>
        أهلاً بعودتك
      </T>
      <T color={colors.muted}>سجّل الدخول برقم هاتفك.</T>
      <Input label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07XX XXX XXXX" autoComplete="tel" textContentType="telephoneNumber" />
      <Input label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={() => login.run()} />
      <Button title="دخول" onPress={() => login.run()} loading={login.busy} />
      {meta?.otpRequired && <Button title="نسيت كلمة المرور؟" variant="ghost" onPress={() => router.push("/forgot-password")} />}
      <Button title="ليس لديك حساب؟ أنشئ حساباً مجاناً" variant="ghost" onPress={() => router.replace("/register")} />
    </Screen>
  );
}
