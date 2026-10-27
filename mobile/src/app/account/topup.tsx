import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { toInt } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { AuthGate } from "@/components/AuthGate";
import { ImagesField } from "@/components/ImagesField";
import { Button, ChipPicker, Field, Input, Notice, Screen, T } from "@/components/ui";

export default function Topup() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("zaincash");
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState<string[]>([]);
  const send = useAction(
    () => api("/me/wallet/topups", { body: { amount: toInt(amount), method, transferRef: ref, receiptImage: receipt[0] } }),
    { success: "تم استلام طلب الشحن. سيُضاف الرصيد بعد التحقق.", invalidate: [["wallet"]], onDone: () => router.back() },
  );
  return (
    <Screen>
      <Notice>
        <T size={14}>حوّل المبلغ ثم أرسل الطلب مع رقم الحوالة أو صورة الإيصال:</T>
        <T size={14} w="semibold">
          زين كاش: {meta?.settings.zaincashNumber}
        </T>
        <T size={14}>أو الدفع نقداً في مكتب المنصة · للاستفسار: {meta?.settings.supportPhone}</T>
      </Notice>
      <Input label="المبلغ (د.ع)" value={amount} onChangeText={(v) => setAmount(String(toInt(v) ?? ""))} keyboardType="number-pad" />
      <ChipPicker options={[25000, 50000, 100000, 250000].map((n) => ({ value: String(n), label: n.toLocaleString("en-US") }))} value={amount} onChange={setAmount} />
      <Field label="طريقة الدفع">
        <ChipPicker options={(meta?.topupMethods ?? []).map((m) => ({ value: m.key, label: m.label }))} value={method} onChange={setMethod} />
      </Field>
      <Input label="رقم الحوالة / المرجع" value={ref} onChangeText={setRef} />
      <ImagesField label="صورة الإيصال (اختياري)" value={receipt} onChange={setReceipt} max={1} isPrivate hint="لا تظهر لأي مستخدم، تراها الإدارة فقط." />
      <Button title="إرسال طلب الشحن" onPress={() => send.run()} loading={send.busy} />
    </Screen>
  );
}
