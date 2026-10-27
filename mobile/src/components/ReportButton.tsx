import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import { Button, ChipPicker, Input, T, styles } from "./ui";

export function ReportButton({ targetType, targetId }: { targetType: "listing" | "auction" | "user" | "provider"; targetId: number }) {
  const { data: meta } = useMeta();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const send = useAction(() => api("/reports", { body: { targetType, targetId, reason, details } }), {
    success: "شكراً لك. وصل البلاغ إلى فريق الإدارة.",
    onDone: () => {
      setOpen(false);
      setReason("");
      setDetails("");
    },
  });
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={{ alignSelf: "center", padding: 8 }}>
        <T size={13} color={colors.muted}>
          🚩 الإبلاغ عن مشكلة
        </T>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { gap: 12 }]}>
          <T w="bold" size={17}>
            سبب البلاغ
          </T>
          <ChipPicker options={(meta?.reportReasons ?? []).map((r) => ({ value: r.key, label: r.label }))} value={reason} onChange={setReason} />
          <Input placeholder="تفاصيل إضافية (اختياري)" value={details} onChangeText={setDetails} multiline />
          <Button title="إرسال البلاغ" variant="danger" onPress={() => send.run()} loading={send.busy} disabled={!reason} />
        </View>
      </Modal>
    </>
  );
}
