import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { deviceName, useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { colors } from "@/lib/theme";
import type { User } from "@/lib/types";
import { Button, Field, Input, Row, Screen, T } from "@/components/ui";

export default function ForgotPasswordScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const send = useAction(() => api("/auth/otp/request", { body: { phone, purpose: "reset" } }), { success: "تم إرسال رمز التحقق." });
  const reset = useAction(
    async () => {
      const { otpToken } = await api<{ otpToken: string }>("/auth/otp/verify", { body: { phone, code, purpose: "reset" } });
      await signIn(await api<{ token: string; user: User }>("/auth/password/reset", { body: { phone, otpToken, password, deviceName: deviceName() } }));
    },
    { success: "تم تغيير كلمة المرور.", onDone: () => router.replace("/") },
  );
  return (
    <Screen>
      <T color={colors.muted}>سنرسل رمز تحقق إلى رقم هاتفك.</T>
      <Field label="رقم الهاتف">
        <Row>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={{ flex: 1 }} />
          <Button title="إرسال الرمز" variant="outline" onPress={() => send.run()} loading={send.busy} />
        </Row>
      </Field>
      <Input label="رمز التحقق" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <Input label="كلمة المرور الجديدة" value={password} onChangeText={setPassword} secureTextEntry hint="8 أحرف على الأقل" />
      <Button title="تغيير كلمة المرور" onPress={() => reset.run()} loading={reset.busy} />
    </Screen>
  );
}
