import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { AuthGate } from "@/components/AuthGate";
import { ImagesField } from "@/components/ImagesField";
import { Button, ChipPicker, Field, Input, Notice, Screen, T } from "@/components/ui";

export default function Verification() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { me, user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("national_id");
  const [docs, setDocs] = useState<string[]>([]);
  const [license, setLicense] = useState<string[]>([]);
  const send = useAction(() => api("/me/verification", { body: { fullName, documentType, documentImages: docs, licenseImage: license[0] } }), {
    success: "تم إرسال طلب التوثيق. تتم المراجعة عادة خلال 24 ساعة.",
    invalidate: [["me"]],
  });
  if (!user) return null;
  if (user.verificationStatus === "verified")
    return (
      <Screen>
        <Notice tone="green">✓ حسابك موثق. تظهر شارة التوثيق بجانب اسمك ويمكنك المشاركة في المزادات.</Notice>
      </Screen>
    );
  if (user.verificationStatus === "pending")
    return (
      <Screen>
        <Notice tone="blue">{`طلبك قيد المراجعة منذ ${dateTime(me?.lastVerificationRequest?.createdAt)}. سنبلغك فور اتخاذ القرار.`}</Notice>
      </Screen>
    );
  const biz = user.role === "vet" || user.role === "shop";
  return (
    <Screen>
      {user.verificationStatus === "rejected" && me?.lastVerificationRequest?.adminNote && (
        <Notice tone="red">{`سبب الرفض السابق: ${me.lastVerificationRequest.adminNote}`}</Notice>
      )}
      <T>التوثيق يرفع ثقة المشترين بك ويفتح ميزة المزادات. صور المستمسكات لا تظهر لأي مستخدم وتراجعها الإدارة فقط.</T>
      <Input label="الاسم الرباعي كما في المستمسك" value={fullName} onChangeText={setFullName} />
      <Field label="نوع المستمسك">
        <ChipPicker
          options={[
            { value: "national_id", label: "البطاقة الوطنية" },
            { value: "passport", label: "جواز السفر" },
            { value: "residence", label: "بطاقة السكن" },
          ]}
          value={documentType}
          onChange={setDocumentType}
        />
      </Field>
      <ImagesField label="صور المستمسك (الوجه والظهر)" value={docs} onChange={setDocs} max={2} isPrivate hint="صوّر المستمسك بوضوح وبدون انعكاس ضوء." />
      {biz && (
        <ImagesField
          label={user.role === "vet" ? "إجازة ممارسة المهنة البيطرية" : "إجازة المحل / الهوية التجارية"}
          value={license}
          onChange={setLicense}
          max={1}
          isPrivate
        />
      )}
      <Button title="إرسال طلب التوثيق" onPress={() => send.run()} loading={send.busy} disabled={!docs.length || (biz && !license.length)} />
    </Screen>
  );
}
