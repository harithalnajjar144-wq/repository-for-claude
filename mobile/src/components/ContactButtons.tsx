import { Linking } from "react-native";
import { whatsappUrl } from "@/lib/format";
import { Button, Row } from "./ui";

export function ContactButtons({ phone, whatsapp, message }: { phone: string; whatsapp?: string | null; message?: string }) {
  return (
    <Row>
      <Button title={`📞 ${phone}`} onPress={() => Linking.openURL(`tel:${phone}`)} style={{ flex: 1 }} />
      <Button title="💬 واتساب" variant="outline" onPress={() => Linking.openURL(whatsappUrl(whatsapp ?? phone, message))} style={{ flex: 1 }} />
    </Row>
  );
}
