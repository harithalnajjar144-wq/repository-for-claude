import { useEffect, useState } from "react";
import { View } from "react-native";
import { colors } from "@/lib/theme";
import { Row, T } from "./ui";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ to, compact, color = colors.ink, onEnd }: { to: string; compact?: boolean; color?: string; onEnd?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = new Date(to).getTime() - now;
  useEffect(() => {
    if (left <= 0) onEnd?.();
  }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (left <= 0)
    return (
      <T size={compact ? 12 : 15} color={color}>
        انتهى
      </T>
    );
  const p = parts(left);
  if (compact)
    return (
      <T size={12} color={color} w="semibold">
        {p.d > 0 ? `${p.d} يوم ` : ""}
        {pad(p.h)}:{pad(p.m)}:{pad(p.s)}
      </T>
    );
  const urgent = left < 5 * 60_000;
  const cells: [number, string][] = [
    [p.d, "يوم"],
    [p.h, "ساعة"],
    [p.m, "دقيقة"],
    [p.s, "ثانية"],
  ];
  return (
    <Row gap={6}>
      {cells.map(([v, l]) => (
        <View key={l} style={{ minWidth: 58, alignItems: "center", borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingVertical: 4 }}>
          <T w="bold" size={20} color={urgent ? colors.red : colors.ink}>
            {pad(v)}
          </T>
          <T size={10} color={colors.muted}>
            {l}
          </T>
        </View>
      ))}
    </Row>
  );
}
