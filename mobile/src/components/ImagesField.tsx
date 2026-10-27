import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { errorMessage, fileUrl, uploadImage } from "@/lib/api";
import { colors } from "@/lib/theme";
import { Button, Field, Row, T, useFeedback } from "./ui";

/** Pick photos from the camera or gallery and upload them right away. `value` holds the uploaded URLs. */
export function ImagesField({
  label = "الصور",
  value,
  onChange,
  max = 8,
  isPrivate = false,
  hint,
}: {
  label?: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  isPrivate?: boolean;
  hint?: string;
}) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(0);
  const room = max - value.length;

  async function handle(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const assets = result.assets.slice(0, room);
    setBusy(assets.length);
    const urls = [...value];
    for (const a of assets) {
      try {
        urls.push(await uploadImage(a.uri, { private: isPrivate, mimeType: a.mimeType, fileName: a.fileName }));
        onChange([...urls]);
      } catch (e) {
        toast(errorMessage(e), "red");
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast("اسمح للتطبيق باستخدام الكاميرا من الإعدادات.", "red");
    await handle(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 }));
  }
  async function fromLibrary() {
    await handle(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
        quality: 0.6,
      }),
    );
  }

  return (
    <Field label={label} hint={hint ?? `حتى ${max} صور`}>
      <Row wrap gap={8}>
        {value.map((u) => (
          <View key={u} style={{ width: 84, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: colors.earth100 }}>
            {isPrivate ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <T size={26}>🪪</T>
                <T size={10} color={colors.muted}>
                  تم الرفع
                </T>
              </View>
            ) : (
              <Image alt="" source={{ uri: fileUrl(u) }} style={{ width: 84, height: 84 }} contentFit="cover" />
            )}
            <Pressable
              accessibilityLabel="حذف الصورة"
              onPress={() => onChange(value.filter((x) => x !== u))}
              style={{ position: "absolute", top: 4, end: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 99, width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
            >
              <T color={colors.white} size={13} w="bold">
                ×
              </T>
            </Pressable>
          </View>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <View key={`busy${i}`} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.earth50, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.brand600} />
          </View>
        ))}
      </Row>
      {room > 0 && (
        <Row>
          <Button title="📷 الكاميرا" variant="outline" small onPress={fromCamera} disabled={busy > 0} />
          <Button title="🖼️ من المعرض" variant="outline" small onPress={fromLibrary} disabled={busy > 0} />
        </Row>
      )}
    </Field>
  );
}
