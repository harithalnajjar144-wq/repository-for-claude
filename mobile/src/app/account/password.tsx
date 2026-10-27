import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { AuthGate } from "@/components/AuthGate";
import { Button, Input, Screen } from "@/components/ui";

export default function Password() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useAction(() => api("/me/password", { body: { current, next } }), { success: "تم تغيير كلمة المرور", onDone: () => router.back() });
  return (
    <Screen>
      <Input label="كلمة المرور الحالية" value={current} onChangeText={setCurrent} secureTextEntry />
      <Input label="كلمة المرور الجديدة" hint="8 أحرف على الأقل" value={next} onChangeText={setNext} secureTextEntry />
      <Button title="تغيير" onPress={() => change.run()} loading={change.busy} />
    </Screen>
  );
}
