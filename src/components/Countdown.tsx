"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to, compact = false, onEnd }: { to: string; compact?: boolean; onEnd?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const left = now === null ? null : new Date(to).getTime() - now;
  useEffect(() => {
    if (left !== null && left <= 0) onEnd?.();
  }, [left, onEnd]);
  if (left === null) return <span className="tabular-nums">--:--</span>;
  if (left <= 0) return <span>انتهى</span>;
  const p = parts(left);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (compact)
    return (
      <span className="tabular-nums" dir="ltr">
        {p.d > 0 ? `${p.d} يوم ` : ""}
        {pad(p.h)}:{pad(p.m)}:{pad(p.s)}
      </span>
    );
  const urgent = left < 5 * 60_000;
  return (
    <div className={`flex gap-2 ${urgent ? "text-red-600" : ""}`} dir="ltr">
      {[
        [p.d, "يوم"],
        [p.h, "ساعة"],
        [p.m, "دقيقة"],
        [p.s, "ثانية"],
      ].map(([v, l]) => (
        <div key={l as string} className="min-w-14 rounded-xl bg-white/80 px-2 py-1.5 text-center ring-1 ring-earth-100">
          <div className="text-xl font-bold tabular-nums">{pad(v as number)}</div>
          <div className="text-[10px] text-ink/50">{l}</div>
        </div>
      ))}
    </div>
  );
}
