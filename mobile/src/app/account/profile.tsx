import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { AuthGate } from "@/components/AuthGate";
import { Button, Input, Screen, Select } from "@/components/ui";

export default function Profile() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const [v, setV] = useState({ name: user?.name ?? "", city: user?.city ?? "", whatsapp: user?.whatsapp ?? "", email: user?.email ?? "", bio: user?.bio ?? "" });
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const save = useAction(() => api("/me", { method: "PATCH", body: v }), { success: "تم حفظ الملف الشخصي", invalidate: [["me"]] });
  const locked = user?.verificationStatus === "verified";
  return (
    <Screen>
      <Input label="الاسم" value={v.name} onChangeText={set("name")} editable={!locked} hint={locked ? "لا يمكن تغيير الاسم بعد التوثيق" : undefined} />
      <Input label="رقم الهاتف (للدخول)" value={user?.phone} editable={false} />
      <Select label="المحافظة" value={v.city} onChange={set("city")} options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))} />
      <Input label="رقم الواتساب" value={v.whatsapp} onChangeText={set("whatsapp")} keyboardType="phone-pad" />
      <Input label="البريد الإلكتروني (اختياري)" value={v.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
      <Input label="نبذة" value={v.bio} onChangeText={set("bio")} multiline placeholder="مثال: مربي أغنام عواسي منذ 15 سنة في الرمادي" />
      <Button title="حفظ" onPress={() => save.run()} loading={save.busy} />
    </Screen>
  );
}
