import { useMemo } from "react";
import { dayLabel } from "@/lib/format";
import { ChipPicker, Field } from "./ui";

/** YYYY-MM-DD of `daysAhead` days from now, in Baghdad time. */
function baghdadDate(daysAhead: number) {
  return new Date(Date.now() + 3 * 3600_000 + daysAhead * 86400_000).toISOString().slice(0, 10);
}

/** Minutes since midnight right now, in Baghdad time. */
function baghdadMinutesNow() {
  const t = new Date(Date.now() + 3 * 3600_000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** ISO timestamp for a Baghdad date + "HH:mm". */
export const toIso = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();

/** Simple date + time picker with chips (works the same on every phone). */
export function DateTimePicker({
  date,
  time,
  onDate,
  onTime,
  days = 14,
  from = 8,
  to = 21,
  step = 30,
}: {
  date: string | null;
  time: string | null;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
  days?: number;
  from?: number;
  to?: number;
  step?: number;
}) {
  const dates = useMemo(
    () => Array.from({ length: days }, (_, i) => baghdadDate(i)).map((d, i) => ({ value: d, label: i === 0 ? "اليوم" : i === 1 ? "غداً" : dayLabel(`${d}T12:00:00+03:00`) })),
    [days],
  );
  const times = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let m = from * 60; m <= to * 60; m += step) {
      const h = Math.floor(m / 60);
      const mm = String(m % 60).padStart(2, "0");
      out.push({ value: `${String(h).padStart(2, "0")}:${mm}`, label: `${h % 12 || 12}:${mm} ${h < 12 ? "ص" : "م"}` });
    }
    const today = baghdadDate(0);
    if (date !== today) return out;
    const nowMin = baghdadMinutesNow() + 30;
    return out.filter((t) => Number(t.value.slice(0, 2)) * 60 + Number(t.value.slice(3)) > nowMin);
  }, [date, from, to, step]);
  return (
    <>
      <Field label="اليوم">
        <ChipPicker options={dates} value={date} onChange={onDate} wrap={false} />
      </Field>
      <Field label="الوقت (بتوقيت بغداد)">
        <ChipPicker options={times} value={time} onChange={onTime} wrap={false} />
      </Field>
    </>
  );
}
