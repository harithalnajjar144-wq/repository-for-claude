import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime, iqd, num } from "@/lib/format";
import { labelOf, useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Wallet } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Badge, Button, Card, Loading, Row, Screen, SectionTitle, Stat, T } from "@/components/ui";

export default function WalletScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { data: meta } = useMeta();
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => api<Wallet>("/me/wallet") });
  if (q.isLoading || !q.data) return <Loading />;
  const w = q.data;
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Row>
        <Stat label="الرصيد المتاح" value={<T w="bold" size={18} color={w.balance < 0 ? colors.red : colors.brand700}>{iqd(w.balance)}</T>} />
        <Stat label="تأمينات محجوزة" value={iqd(w.heldDeposits)} />
      </Row>
      <T size={13} color={colors.muted}>
        تُستخدم المحفظة لتأمينات المزادات، الاشتراكات، تمييز الإعلانات، وعمولات المزاد.
      </T>
      <Button title="+ شحن المحفظة" onPress={() => router.push("/account/topup")} />

      {w.topups.length > 0 && (
        <>
          <SectionTitle title="طلبات الشحن" />
          {w.topups.map((t) => (
            <Card key={t.id}>
              <Row style={{ justifyContent: "space-between" }}>
                <View>
                  <T w="semibold">{iqd(t.amount)}</T>
                  <T size={12} color={colors.muted}>
                    {labelOf(meta?.topupMethods, t.method)} · {dateTime(t.createdAt)}
                  </T>
                  {t.adminNote && (
                    <T size={12} color={colors.muted}>
                      {t.adminNote}
                    </T>
                  )}
                </View>
                <Badge
                  label={t.status === "approved" ? "تمت الإضافة" : t.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                  tone={t.status === "approved" ? "green" : t.status === "rejected" ? "red" : "amber"}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      <SectionTitle title="سجل الحركات" />
      {w.transactions.length === 0 ? (
        <T color={colors.muted}>لا توجد حركات بعد.</T>
      ) : (
        <Card style={{ padding: 0 }}>
          {w.transactions.map((t, i) => (
            <View key={t.id} style={[{ padding: 12, gap: 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <Row style={{ justifyContent: "space-between" }}>
                <T w="medium" size={14}>
                  {meta?.labels.txTypes[t.type] ?? t.type}
                </T>
                <T w="bold" color={t.amount > 0 ? colors.brand700 : t.amount < 0 ? colors.red : colors.ink}>
                  {t.amount > 0 ? "+" : t.amount < 0 ? "−" : ""}
                  {num(Math.abs(t.amount))}
                </T>
              </Row>
              {t.note && (
                <T size={12} color={colors.muted}>
                  {t.note}
                </T>
              )}
              <T size={11} color={colors.faint}>
                {dateTime(t.createdAt)} · الرصيد بعدها {iqd(t.balanceAfter)}
              </T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
