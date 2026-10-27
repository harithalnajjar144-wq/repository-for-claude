import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { deviceName, useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { User } from "@/lib/types";
import { Button, Field, Input, Row, Screen, Select, T } from "@/components/ui";

const ROLES = [
  { key: "user", icon: "🛒", title: "مستخدم", desc: "تصفح، شراء، ومزايدات" },
  { key: "trader", icon: "🐑", title: "تاجر / مربي", desc: "انشر إعلانات وافتح مزادات" },
  { key: "vet", icon: "🩺", title: "طبيب بيطري", desc: "اعرض خدماتك واستقبل الحجوزات" },
  { key: "shop", icon: "🏪", title: "محل رعاية وتجهيز", desc: "اعرض الأعلاف والمستلزمات" },
] as const;

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const { data: meta } = useMeta();
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("user");
  const [form, setForm] = useState({ name: "", phone: "", password: "", city: "", businessName: "", code: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const otp = !!meta?.otpRequired;

  const sendCode = useAction(() => api("/auth/otp/request", { body: { phone: form.phone, purpose: "register" } }), { success: "تم إرسال رمز التحقق برسالة نصية." });

  const submit = useAction(
    async () => {
      let otpToken: string | undefined;
      if (otp) otpToken = (await api<{ otpToken: string }>("/auth/otp/verify", { body: { phone: form.phone, code: form.code, purpose: "register" } })).otpToken;
      const s = await api<{ token: string; user: User }>("/auth/register", {
        body: { ...form, role, otpToken, deviceName: deviceName(), businessName: form.businessName || undefined },
      });
      await signIn(s);
    },
    { success: "🎉 تم إنشاء حسابك بنجاح", onDone: () => router.replace("/(tabs)/account") },
  );

  return (
    <Screen>
      <T w="bold" size={22}>
        انضم إلى حلالي
      </T>
      <T color={colors.muted}>التسجيل مجاني. اختر نوع حسابك.</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ROLES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setRole(r.key)}
            style={{
              width: "48.5%",
              borderWidth: 1.5,
              borderColor: role === r.key ? colors.brand500 : colors.line,
              backgroundColor: role === r.key ? colors.brand50 : colors.white,
              borderRadius: 14,
              padding: 10,
            }}
          >
            <T size={22}>{r.icon}</T>
            <T w="semibold">{r.title}</T>
            <T size={12} color={colors.muted}>
              {r.desc}
            </T>
          </Pressable>
        ))}
      </View>
      {(role === "vet" || role === "shop") && <Input label={role === "vet" ? "اسم العيادة أو الطبيب" : "اسم المحل"} value={form.businessName} onChangeText={set("businessName")} />}
      <Input label="الاسم الكامل" value={form.name} onChangeText={set("name")} autoComplete="name" />
      <Field label="رقم الهاتف">
        <Row>
          <Input value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="07XX XXX XXXX" style={{ flex: 1 }} />
          {otp && <Button title="إرسال الرمز" variant="outline" onPress={() => sendCode.run()} loading={sendCode.busy} disabled={form.phone.length < 10} />}
        </Row>
      </Field>
      {otp && <Input label="رمز التحقق" value={form.code} onChangeText={set("code")} keyboardType="number-pad" maxLength={6} placeholder="------" autoComplete="sms-otp" textContentType="oneTimeCode" />}
      <Select
        label="المحافظة"
        value={form.city}
        onChange={set("city")}
        options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))}
      />
      <Input label="كلمة المرور" hint="8 أحرف على الأقل" value={form.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" />
      <T size={12} color={colors.muted}>
        بالتسجيل أنت توافق على شروط استخدام منصة حلالي.
      </T>
      <Button title="إنشاء الحساب" onPress={() => submit.run()} loading={submit.busy} />
      <Button title="لديك حساب؟ سجّل الدخول" variant="ghost" onPress={() => router.replace("/login")} />
    </Screen>
  );
}
