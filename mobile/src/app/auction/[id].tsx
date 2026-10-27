import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ageLabel, dateTime, iqd, num, timeOf, toInt } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { AuctionDetail, AuctionState } from "@/lib/types";
import { AuctionBadge } from "@/components/cards";
import { ContactButtons } from "@/components/ContactButtons";
import { Countdown } from "@/components/Countdown";
import { Gallery } from "@/components/Gallery";
import { ReportButton } from "@/components/ReportButton";
import { Button, Card, Chip, ErrorView, Input, Loading, Notice, Row, T, Verified } from "@/components/ui";

export default function AuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn, user, me } = useAuth();
  const { meta, category, city, icon } = useLabels();
  const qc = useQueryClient();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const detail = useQuery({ queryKey: ["auction", id], queryFn: () => api<AuctionDetail>(`/auctions/${id}`) });
  const live = detail.data && ["scheduled", "live", "closing"].includes(detail.data.state.status);
  const stateQ = useQuery({
    queryKey: ["auction-state", id],
    queryFn: () => api<AuctionState>(`/auctions/${id}/state`),
    enabled: !!detail.data,
    refetchInterval: focused && live ? 3000 : false,
    initialData: detail.data?.state,
  });
  const s = stateQ.data ?? detail.data?.state;

  // When the auction changes phase (e.g. it ends), reload the full details.
  const lastStatus = useRef(s?.status);
  useEffect(() => {
    if (s && lastStatus.current && s.status !== lastStatus.current) {
      void detail.refetch();
      void qc.invalidateQueries({ queryKey: ["me"] });
    }
    lastStatus.current = s?.status;
  }, [s?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const [amount, setAmount] = useState<string | null>(null);
  const refresh = [["auction", id], ["auction-state", id], ["me"], ["my-auctions"]];
  const join = useAction(() => api<{ deposit: { amount: number } }>(`/auctions/${id}/join`, { method: "POST" }), {
    success: (r) => `تم حجز التأمين (${iqd(r.deposit.amount)}). يمكنك المزايدة الآن.`,
    invalidate: refresh,
    confirm: s ? `سيتم حجز ${iqd(s.depositAmount)} من محفظتك كتأمين. يُعاد بالكامل إن لم تفز. متابعة؟` : undefined,
  });
  const bidValue = toInt(amount ?? "") ?? s?.minNext ?? 0;
  const bid = useAction(() => api<{ amount: number; extended: boolean }>(`/auctions/${id}/bids`, { body: { amount: bidValue } }), {
    success: (r) => `تم تسجيل مزايدتك بقيمة ${iqd(r.amount)}${r.extended ? " · تم تمديد المزاد دقيقتين" : ""}`,
    invalidate: [["auction-state", id]],
    confirm: `تأكيد المزايدة بمبلغ ${iqd(bidValue)}؟ المزايدة مُلزِمة.`,
    onDone: () => setAmount(null),
  });
  const complete = useAction(() => api(`/auctions/${id}/complete`, { method: "POST" }), {
    success: "تم تأكيد التسليم وإرجاع تأمين الفائز",
    invalidate: refresh,
    confirm: "هل استلم الفائز الحيوان ودفع المبلغ؟ سيُعاد له التأمين.",
  });
  const cancel = useAction(() => api(`/auctions/${id}/cancel`, { method: "POST" }), {
    success: "تم إلغاء المزاد",
    invalidate: refresh,
    confirm: "إلغاء المزاد وإرجاع التأمينات؟",
    danger: true,
  });

  if (detail.isLoading) return <Loading />;
  if (!detail.data || !s) return <ErrorView error={detail.error} onRetry={() => detail.refetch()} />;
  const { auction: a, seller, winner } = detail.data;
  const phase = s.status;
  const isSeller = !!s.me?.isSeller;
  const verified = user?.verificationStatus === "verified";
  const requireVerified = meta?.settings.requireVerificationForAuctions ?? true;
  const balance = me?.user.walletBalance ?? 0;
  const price = s.winningBid ?? s.currentPrice ?? s.startPrice;
  const facts: [string, string | null][] = [
    ["النوع", `${icon(a.category)} ${category(a.category)}`],
    ["السلالة", a.breed],
    ["العدد", num(a.quantity)],
    ["العمر", ageLabel(a.ageMonths)],
    ["الجنس", a.gender !== "unknown" ? (meta?.labels.genders[a.gender] ?? null) : null],
    ["الوزن", a.weightKg ? `${a.weightKg} كغم` : null],
    ["الموقع", city(a.city)],
    ["سعر البداية", iqd(a.startPrice)],
    ["أقل زيادة", iqd(a.minIncrement)],
    ["التأمين", iqd(a.depositAmount)],
    ["يبدأ", dateTime(a.startsAt)],
    ["ينتهي", dateTime(s.endsAt)],
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `مزاد #${a.id}` }} />
      <Gallery images={a.images} category={a.category} />
      <View style={{ padding: 16, gap: 14 }}>
        <Row>
          <AuctionBadge a={{ ...a, status: a.status, endsAt: s.endsAt }} />
        </Row>
        <T w="bold" size={20}>
          {a.title}
        </T>

        {/* Live panel */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={{ backgroundColor: phase === "live" ? colors.brand700 : colors.earth50, padding: 14 }}>
            <T size={13} color={phase === "live" ? colors.brand100 : colors.muted}>
              {s.currentPrice ? (phase === "live" ? "أعلى مزايدة حالياً" : "السعر النهائي") : "سعر البداية"}
            </T>
            <T w="bold" size={28} color={phase === "live" ? colors.white : colors.ink}>
              {iqd(price)}
            </T>
            <T size={13} color={phase === "live" ? colors.brand100 : colors.muted}>
              {s.bidCount} مزايدة
              {s.hasReserve && s.currentPrice !== null ? (s.reserveMet ? " · ✓ تم تجاوز السعر الأدنى" : " · لم يصل للسعر الأدنى بعد") : ""}
            </T>
          </View>
          <View style={{ padding: 14, gap: 12 }}>
            {(phase === "live" || phase === "scheduled") && (
              <View style={{ gap: 6 }}>
                <T size={13} color={colors.muted}>
                  {phase === "live" ? "ينتهي المزاد خلال" : "يبدأ المزاد خلال"}
                </T>
                <Countdown to={phase === "live" ? s.endsAt : s.startsAt} onEnd={() => void stateQ.refetch()} />
                {phase === "live" && (
                  <T size={12} color={colors.faint}>
                    أي مزايدة في آخر دقيقتين تمدد المزاد دقيقتين.
                  </T>
                )}
              </View>
            )}
            {phase === "closing" && <T color={colors.muted}>جارٍ إغلاق المزاد واحتساب النتيجة…</T>}

            {(phase === "live" || phase === "scheduled") && !isSeller && (
              <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                {!signedIn ? (
                  <Button title="سجّل الدخول للمشاركة" onPress={() => router.push("/login")} />
                ) : requireVerified && !verified ? (
                  <>
                    <T size={14}>المشاركة في المزادات للحسابات الموثقة فقط لضمان جدية المزايدين.</T>
                    <Button title="وثّق حسابك الآن" onPress={() => router.push("/account/verification")} />
                  </>
                ) : s.me?.deposit !== "held" ? (
                  <>
                    <T size={14}>
                      للمزايدة يُحجز تأمين قدره <T w="bold">{iqd(s.depositAmount)}</T> من محفظتك. يُعاد بالكامل إن لم تفز، ويُعاد للفائز بعد إتمام الاستلام.
                    </T>
                    <T size={12} color={colors.muted}>
                      رصيدك: {iqd(balance)}
                    </T>
                    {balance < s.depositAmount ? (
                      <Button title="اشحن المحفظة" variant="earth" onPress={() => router.push("/account/topup")} />
                    ) : (
                      <Button title="حجز التأمين والمشاركة" variant="earth" onPress={() => join.run()} loading={join.busy} />
                    )}
                  </>
                ) : phase === "live" ? (
                  <>
                    {s.me?.isTop && <Notice tone="green">👑 أنت صاحب أعلى مزايدة</Notice>}
                    <Input label={`مبلغ المزايدة (أقل مبلغ ${iqd(s.minNext)})`} value={amount ?? String(s.minNext)} onChangeText={setAmount} keyboardType="number-pad" style={{ fontSize: 20 }} />
                    <Row>
                      {[1, 2, 5].map((k) => (
                        <Chip key={k} label={`+${num(s.minIncrement * k)}`} onPress={() => setAmount(String((s.currentPrice ?? s.startPrice - s.minIncrement) + s.minIncrement * k))} />
                      ))}
                    </Row>
                    <Button title="زايد الآن" onPress={() => bid.run()} loading={bid.busy} disabled={bidValue < s.minNext} />
                  </>
                ) : (
                  <T color={colors.brand700}>✓ تم حجز تأمينك. ستتمكن من المزايدة عند بدء المزاد.</T>
                )}
              </View>
            )}

            {s.me?.isWinner && (phase === "ended" || phase === "completed") && <Notice tone="green">🎉 مبروك! فزت بهذا المزاد. تواصل مع البائع أدناه لإتمام الاستلام.</Notice>}

            <View style={{ gap: 4 }}>
              <T w="semibold">سجل المزايدات</T>
              {s.bids.length === 0 ? (
                <T size={13} color={colors.muted}>
                  لا توجد مزايدات بعد. كن أول المزايدين!
                </T>
              ) : (
                s.bids.slice(0, 15).map((b, i) => (
                  <Row key={b.id} style={{ justifyContent: "space-between", backgroundColor: i === 0 ? colors.earth50 : "transparent", borderRadius: 8, padding: 6 }}>
                    <T w={i === 0 ? "semibold" : "regular"} color={b.mine ? colors.brand700 : colors.ink} size={14}>
                      {i === 0 ? "👑 " : ""}
                      {b.name}
                    </T>
                    <T w="semibold" size={14}>
                      {iqd(b.amount)}
                    </T>
                    <T size={11} color={colors.faint}>
                      {timeOf(b.at)}
                    </T>
                  </Row>
                ))
              )}
            </View>
          </View>
        </Card>

        {/* Seller tools */}
        {isSeller && (
          <Card style={{ gap: 10 }}>
            <T w="semibold">إدارة المزاد</T>
            {winner && (
              <View style={{ backgroundColor: colors.brand50, borderRadius: 12, padding: 10, gap: 6 }}>
                <T w="semibold">الفائز: {winner.name}</T>
                <T size={13}>
                  السعر النهائي {iqd(a.winningBid)} · العمولة {iqd(a.commissionAmount)}
                </T>
                <ContactButtons phone={winner.phone} message={`السلام عليكم، بخصوص مزاد حلالي رقم ${a.id}: ${a.title}`} />
              </View>
            )}
            {a.status === "ended" && (
              <>
                <Button title="✓ تأكيد إتمام التسليم" onPress={() => complete.run()} loading={complete.busy} />
                <T size={12} color={colors.muted}>
                  إذا انسحب الفائز، أبلغ الإدارة وسيتم مصادرة تأمينه لتعويضك.
                </T>
              </>
            )}
            {(a.status === "scheduled" || a.status === "live") && a.bidCount === 0 && <Button title="إلغاء المزاد" variant="outline" onPress={() => cancel.run()} loading={cancel.busy} />}
          </Card>
        )}

        {/* Seller card / contact for winner */}
        {!isSeller && (
          <Card style={{ gap: 10 }}>
            <Row>
              <T w="semibold">{seller.name}</T>
              <Verified status={seller.verificationStatus} />
            </Row>
            {seller.phone ? <ContactButtons phone={seller.phone} whatsapp={seller.whatsapp} message={`السلام عليكم، أنا الفائز بمزاد حلالي رقم ${a.id}`} /> : null}
            <Button title="ملف البائع" variant="ghost" onPress={() => router.push({ pathname: "/user/[id]", params: { id: String(seller.id) } })} />
          </Card>
        )}

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={{ width: "48%", backgroundColor: colors.earth50, borderRadius: 10, padding: 8 }}>
                  <T size={11} color={colors.muted}>
                    {k}
                  </T>
                  <T w="medium" size={13}>
                    {v}
                  </T>
                </View>
              ))}
          </View>
          <T w="semibold">الوصف</T>
          <T style={{ lineHeight: 26 }}>{a.description}</T>
        </Card>

        <Card style={{ gap: 4 }}>
          <T w="semibold">قواعد المزاد</T>
          {[
            "المشاركة للحسابات الموثقة بعد حجز مبلغ التأمين من المحفظة.",
            "كل مزايدة مُلزِمة ويجب أن تزيد عن السابقة بالحد الأدنى على الأقل.",
            "أعلى مزايدة عند انتهاء الوقت تفوز، ويُعاد التأمين لغير الفائزين فوراً.",
            "يُعاد تأمين الفائز بعد تأكيد البائع للتسليم، ويُصادر إن انسحب.",
            `تستقطع المنصة عمولة ${(Number(a.commissionRate) * 100).toFixed(1)}% من البائع على السعر النهائي.`,
          ].map((r) => (
            <T key={r} size={13} color={colors.muted}>
              • {r}
            </T>
          ))}
        </Card>
        {signedIn && !isSeller && <ReportButton targetType="auction" targetId={a.id} />}
      </View>
    </ScrollView>
  );
}
