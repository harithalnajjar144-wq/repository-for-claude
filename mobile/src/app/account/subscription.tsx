import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateOnly, iqd } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Plan } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Button, Card, ChipPicker, Loading, Notice, Screen, T } from "@/components/ui";

export default function Subscription() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { me, user } = useAuth();
  const { data: meta } = useMeta();
  const [months, setMonths] = useState(1);
  const plans = useQuery({ queryKey: ["plans", user?.role], queryFn: () => api<Plan[]>("/plans") });
  const sub = useAction(
    (p: Plan) => api<{ endsAt: string }>("/me/subscription", { body: { planId: p.id, months } }),
    { success: (r) => `تم الاشتراك حتى ${dateOnly(r.endsAt)}`, invalidate: [["me"], ["wallet"]] },
  );
  if (plans.isLoading) return <Loading />;
  return (
    <Screen>
      {me?.subscription ? (
        <Notice tone="green">{`باقتك الحالية: ${me.subscription.plan.name} حتى ${dateOnly(me.subscription.endsAt)}. التجديد يضيف المدة إلى نهاية اشتراكك.`}</Notice>
      ) : (
        <Notice>{`أنت على الحساب المجاني: ${meta?.settings.freeActiveListings ?? 3} إعلانات نشطة${user?.role === "trader" ? ` و ${meta?.settings.freeActiveAuctions ?? 1} مزاد نشط` : ""}.`}</Notice>
      )}
      <ChipPicker
        options={[
          { value: 1, label: "شهر" },
          { value: 3, label: "3 أشهر" },
          { value: 6, label: "6 أشهر" },
          { value: 12, label: "سنة" },
        ]}
        value={months}
        onChange={setMonths}
      />
      {!plans.data?.length && <T color={colors.muted}>لا توجد باقات مدفوعة لنوع حسابك حالياً. الاستخدام مجاني.</T>}
      {plans.data?.map((p) => (
        <Card key={p.id} style={[{ gap: 6 }, me?.subscription?.plan.id === p.id && { borderColor: colors.brand500, borderWidth: 2 }]}>
          <T w="bold" size={18}>
            {p.name}
          </T>
          <T w="bold" size={20} color={colors.brand700}>
            {iqd(p.priceMonthly)}
            <T size={13} color={colors.muted}>
              {" "}
              / شهر
            </T>
          </T>
          <T size={14}>✓ {p.maxActiveListings === null ? "إعلانات غير محدودة" : `${p.maxActiveListings} إعلان نشط`}</T>
          {p.role === "trader" && <T size={14}>✓ {p.maxActiveAuctions === null ? "مزادات غير محدودة" : `${p.maxActiveAuctions} مزاد نشط`}</T>}
          {p.features.map((f) => (
            <T key={f} size={14}>
              ✓ {f}
            </T>
          ))}
          <Button
            title={`${me?.subscription?.plan.id === p.id ? "تجديد" : "اشترك"} · ${iqd(p.priceMonthly * months)}`}
            onPress={async () => {
              await sub.run(p);
            }}
            loading={sub.busy}
          />
        </Card>
      ))}
      <T size={12} color={colors.muted} center>
        يُدفع الاشتراك من رصيد المحفظة.
      </T>
    </Screen>
  );
}
