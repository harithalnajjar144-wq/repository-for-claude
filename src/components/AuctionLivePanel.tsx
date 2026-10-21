"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/errors";
import type { AuctionLiveState } from "@/lib/auctionState";
import { Countdown } from "./Countdown";
import { SubmitButton } from "./forms";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const nf = new Intl.NumberFormat("ar-IQ-u-nu-latn");
const iqd = (n: number) => `${nf.format(n)} د.ع`;
const t = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { timeStyle: "medium", timeZone: "Asia/Baghdad" });

export function AuctionLivePanel({
  initial,
  loggedIn,
  verified,
  walletBalance,
  joinAction,
  bidAction,
}: {
  initial: NonNullable<AuctionLiveState>;
  loggedIn: boolean;
  verified: boolean;
  walletBalance: number;
  joinAction: Action;
  bidAction: Action;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  // null = follow the current minimum bid automatically
  const [custom, setCustom] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/auctions/${initial.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const next = (await r.json()) as NonNullable<AuctionLiveState>;
      setS((prev) => {
        if (prev.status !== next.status) router.refresh();
        return next;
      });
    } catch {
      /* network hiccup; next poll will retry */
    }
  }, [initial.id, router]);

  useEffect(() => {
    const iv = setInterval(refresh, s.status === "live" ? 3000 : 10000);
    return () => clearInterval(iv);
  }, [refresh, s.status]);

  const [joinState, join] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await joinAction(prev, fd);
    await refresh();
    return r;
  }, undefined);
  const [bidState, bid] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await bidAction(prev, fd);
    if (r?.ok) setCustom(null);
    await refresh();
    return r;
  }, undefined);

  const amount = custom ?? String(s.minNext);
  const setAmount = (v: string) => setCustom(v);

  const live = s.status === "live";
  const upcoming = s.status === "scheduled";
  const price = s.winningBid ?? s.currentPrice ?? s.startPrice;

  return (
    <div className="card overflow-hidden">
      <div className={`px-5 py-4 ${live ? "bg-gradient-to-l from-brand-700 to-brand-600 text-white" : "bg-earth-50"}`}>
        <div className="text-sm opacity-80">{s.currentPrice ? (live ? "أعلى مزايدة حالياً" : "السعر النهائي") : "سعر البداية"}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{iqd(price)}</div>
        <div className="mt-1 text-sm opacity-80">
          {s.bidCount} مزايدة
          {s.hasReserve && s.currentPrice !== null && <> · {s.reserveMet ? "✓ تم تجاوز السعر الأدنى" : "لم يصل للسعر الأدنى بعد"}</>}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {(live || upcoming) && (
          <div>
            <div className="mb-2 text-sm text-ink/60">{live ? "ينتهي المزاد خلال" : "يبدأ المزاد خلال"}</div>
            <Countdown to={live ? s.endsAt : s.startsAt} onEnd={refresh} />
            {live && <p className="mt-2 text-xs text-ink/50">أي مزايدة في آخر دقيقتين تمدد المزاد دقيقتين لمنع القنص.</p>}
          </div>
        )}

        {s.status === "closing" && <p className="text-sm text-ink/60">جارٍ إغلاق المزاد واحتساب النتيجة…</p>}

        {/* Participation */}
        {(live || upcoming) && !s.me?.isSeller && (
          <div className="rounded-xl border border-earth-100 p-4">
            {!loggedIn ? (
              <Link href={`/login?next=/auctions/${s.id}`} className="btn-primary w-full">سجّل الدخول للمشاركة</Link>
            ) : !verified ? (
              <div className="space-y-2 text-sm">
                <p>المشاركة في المزادات متاحة للحسابات الموثقة فقط لضمان جدية المزايدين.</p>
                <Link href="/dashboard/profile#verify" className="btn-primary w-full">وثّق حسابك الآن</Link>
              </div>
            ) : s.me?.deposit !== "held" ? (
              <form action={join} className="space-y-3 text-sm">
                <input type="hidden" name="auctionId" value={s.id} />
                <p>
                  للمزايدة يجب حجز تأمين قدره <b>{iqd(s.depositAmount)}</b> من محفظتك. يُعاد بالكامل إن لم تفز، ويُعاد للفائز
                  بعد إتمام الاستلام.
                </p>
                <p className="text-xs text-ink/55">رصيدك الحالي: {iqd(walletBalance)}</p>
                {walletBalance < s.depositAmount ? (
                  <Link href="/dashboard/wallet" className="btn-earth w-full">اشحن المحفظة</Link>
                ) : (
                  <SubmitButton className="btn-earth w-full" pendingText="جارٍ الحجز…">حجز التأمين والمشاركة</SubmitButton>
                )}
                {joinState?.error && <p className="text-red-600">{joinState.error}</p>}
              </form>
            ) : live ? (
              <form action={bid} className="space-y-3">
                <input type="hidden" name="auctionId" value={s.id} />
                {s.me?.isTop && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">👑 أنت صاحب أعلى مزايدة</p>}
                <label className="block">
                  <span className="label">مبلغ المزايدة (أقل مبلغ {iqd(s.minNext)})</span>
                  <input
                    name="amount"
                    type="number"
                    min={s.minNext}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr"
                    className="input text-end text-lg font-bold"
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 5].map((k) => (
                    <button key={k} type="button" className="btn-outline px-2 text-xs" onClick={() => setAmount(String((s.currentPrice ?? s.startPrice - s.minIncrement) + s.minIncrement * k))}>
                      +{nf.format(s.minIncrement * k)}
                    </button>
                  ))}
                </div>
                <SubmitButton className="btn-primary w-full text-base" pendingText="جارٍ المزايدة…" confirm={`تأكيد المزايدة بمبلغ ${iqd(Number(amount))}؟ المزايدة مُلزِمة.`}>
                  زايد الآن
                </SubmitButton>
                {bidState?.error && <p className="text-sm text-red-600">{bidState.error}</p>}
                {bidState?.message && <p className="text-sm text-brand-700">{bidState.message}</p>}
              </form>
            ) : (
              <p className="text-sm text-brand-700">✓ تم حجز تأمينك. ستتمكن من المزايدة عند بدء المزاد.</p>
            )}
          </div>
        )}

        {s.me?.isWinner && (s.status === "ended" || s.status === "completed") && (
          <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">🎉 مبروك! فزت بهذا المزاد. بيانات البائع ظاهرة أدناه لإتمام الاستلام.</div>
        )}

        {/* Bid history */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">سجل المزايدات</h3>
          {s.bids.length === 0 ? (
            <p className="text-sm text-ink/50">لا توجد مزايدات بعد. كن أول المزايدين!</p>
          ) : (
            <ol className="max-h-72 space-y-1 overflow-y-auto">
              {s.bids.map((b, i) => (
                <li key={b.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${i === 0 ? "bg-earth-50 font-semibold" : ""} ${b.mine ? "text-brand-700" : ""}`}>
                  <span>{i === 0 && "👑 "}{b.name}</span>
                  <span className="tabular-nums">{iqd(b.amount)}</span>
                  <span className="text-xs font-normal text-ink/45">{t.format(new Date(b.at))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
