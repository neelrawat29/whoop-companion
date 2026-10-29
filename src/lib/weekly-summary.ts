// Weekly summary shared by web Insights and the iPhone
// (/api/public/ios/weekly-summary): the last 7 days vs the 7 before,
// best/worst recovery days with what came the evening before, and how
// consistently the week was logged.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hasEveningLog, lateMinutes, type HabitInsightRow } from "./habit-insights";

export type WeeklyMetricKey = "recovery" | "hrv" | "rhr" | "sleep_hours" | "strain" | "kcal" | "protein_g" | "hydration";

export type WeeklyMetric = {
  key: WeeklyMetricKey;
  label: string;
  thisWeek: number | null;
  lastWeek: number | null;
  thisText: string;
  /** e.g. "+6 pts", "−25 min"; null when either week has no data. */
  deltaText: string | null;
  /** null = neutral metric or no clear change. */
  better: boolean | null;
  days: number;
};

export type DayNote = {
  date: string;
  /** e.g. "Wed 29 Oct". */
  dayLabel: string;
  recovery: number;
  /** What came before: sleep that night and the previous evening's log. */
  notes: string[];
};

export type WeeklySummary = {
  start: string;
  end: string;
  headline: string;
  metrics: WeeklyMetric[];
  best: DayNote | null;
  worst: DayNote | null;
  logging: { eveningCheckIns: number; mealDays: number; days: number };
};

export type WeeklyEntry = { entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null };
export type WeeklyMealDay = { entry_date: string; kcal: number; protein_g: number };

type Cfg = { label: string; higherIsBetter: boolean | null; notable: number; fmt: (v: number) => string; fmtDelta: (d: number) => string };

const sign = (d: number) => (d > 0 ? "+" : "−");
const hm = (v: number) => { const m = Math.round(v * 60); return `${Math.floor(m / 60)}h ${m % 60}m`; };

const CFG: Record<WeeklyMetricKey, Cfg> = {
  recovery: { label: "Recovery", higherIsBetter: true, notable: 3, fmt: (v) => `${Math.round(v)}%`, fmtDelta: (d) => `${sign(d)}${Math.abs(Math.round(d))} pts` },
  hrv: { label: "HRV", higherIsBetter: true, notable: 3, fmt: (v) => `${Math.round(v)} ms`, fmtDelta: (d) => `${sign(d)}${Math.abs(Math.round(d))} ms` },
  rhr: { label: "Resting HR", higherIsBetter: false, notable: 1.5, fmt: (v) => `${Math.round(v)} bpm`, fmtDelta: (d) => `${sign(d)}${Math.abs(d).toFixed(1)} bpm` },
  sleep_hours: { label: "Sleep", higherIsBetter: true, notable: 0.25, fmt: hm, fmtDelta: (d) => `${sign(d)}${Math.round(Math.abs(d) * 60)} min` },
  strain: { label: "Strain", higherIsBetter: null, notable: 1, fmt: (v) => v.toFixed(1), fmtDelta: (d) => `${sign(d)}${Math.abs(d).toFixed(1)}` },
  kcal: { label: "Calories eaten", higherIsBetter: null, notable: 150, fmt: (v) => `${Math.round(v).toLocaleString("en-US")} kcal`, fmtDelta: (d) => `${sign(d)}${Math.abs(Math.round(d)).toLocaleString("en-US")} kcal` },
  protein_g: { label: "Protein", higherIsBetter: true, notable: 10, fmt: (v) => `${Math.round(v)} g`, fmtDelta: (d) => `${sign(d)}${Math.abs(Math.round(d))} g` },
  hydration: { label: "Water", higherIsBetter: true, notable: 250, fmt: (v) => `${(v / 1000).toFixed(1)} L`, fmtDelta: (d) => `${sign(d)}${(Math.abs(d) / 1000).toFixed(1)} L` },
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shiftDate(d: string, days: number): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function dayLabel(d: string) {
  const t = new Date(d + "T00:00:00Z");
  return `${DOW[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`;
}

function fmtClock(time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return time;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}${m[2] === "00" ? "" : `:${m[2]}`}${h < 12 ? "am" : "pm"}`;
}

function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

export function buildWeeklySummary(input: {
  today: string;
  entries: WeeklyEntry[];
  habits: HabitInsightRow[];
  mealDays: WeeklyMealDay[];
}): WeeklySummary {
  const end = input.today;
  const start = shiftDate(end, -6);
  const prevStart = shiftDate(end, -13);
  const inThis = (d: string) => d >= start && d <= end;
  const inLast = (d: string) => d >= prevStart && d < start;

  const entries = new Map(input.entries.map((e) => [e.entry_date, e]));
  const habits = new Map(input.habits.map((h) => [h.entry_date, h]));
  const meals = new Map(input.mealDays.map((m) => [m.entry_date, m]));

  const valuesFor = (key: WeeklyMetricKey, pick: (d: string) => boolean): number[] => {
    const out: number[] = [];
    if (key === "kcal" || key === "protein_g") {
      // Only days that look fully logged.
      for (const m of input.mealDays) if (pick(m.entry_date) && m.kcal >= 1000) out.push(m[key]);
    } else if (key === "strain" || key === "hydration") {
      for (const h of input.habits) {
        if (!pick(h.entry_date)) continue;
        const v = h[key];
        if (v != null && v > 0) out.push(Number(v));
      }
    } else {
      for (const e of input.entries) {
        if (!pick(e.entry_date)) continue;
        const v = e[key];
        if (v != null && Number(v) > 0) out.push(Number(v));
      }
    }
    return out;
  };

  const metrics: WeeklyMetric[] = (Object.keys(CFG) as WeeklyMetricKey[]).map((key) => {
    const cfg = CFG[key];
    const a = valuesFor(key, inThis);
    const b = valuesFor(key, inLast);
    const thisWeek = avg(a);
    const lastWeek = avg(b);
    const delta = thisWeek != null && lastWeek != null ? thisWeek - lastWeek : null;
    const clear = delta != null && Math.abs(delta) >= cfg.notable;
    return {
      key,
      label: cfg.label,
      thisWeek,
      lastWeek,
      thisText: thisWeek != null ? cfg.fmt(thisWeek) : "—",
      deltaText: delta != null ? cfg.fmtDelta(delta) : null,
      better: clear && cfg.higherIsBetter != null ? (cfg.higherIsBetter ? delta! > 0 : delta! < 0) : null,
      days: a.length,
    };
  });

  // Best / worst recovery days this week, with what came before.
  const recDays = [...entries.values()]
    .filter((e) => inThis(e.entry_date) && e.recovery != null)
    .sort((x, y) => x.entry_date.localeCompare(y.entry_date));
  const noteFor = (e: WeeklyEntry): DayNote => {
    const notes: string[] = [];
    if (e.sleep_hours) notes.push(`${hm(e.sleep_hours)} sleep`);
    const prev = shiftDate(e.entry_date, -1);
    const h = habits.get(prev);
    if (h?.strain != null) notes.push(`strain ${Number(h.strain).toFixed(1)} the day before`);
    if (h && hasEveningLog(h)) {
      const drinks = h.drinks ?? 0;
      notes.push(drinks > 0 ? `${drinks} drink${drinks === 1 ? "" : "s"}` : "no drinks");
      const caf = lateMinutes(h.last_caffeine_time);
      if (caf != null && caf >= 14 * 60 && h.last_caffeine_time) notes.push(`caffeine at ${fmtClock(h.last_caffeine_time)}`);
      const meal = lateMinutes(h.last_meal_time);
      if (meal != null && meal >= 21 * 60 && h.last_meal_time) notes.push(`ate at ${fmtClock(h.last_meal_time)}`);
    }
    return { date: e.entry_date, dayLabel: dayLabel(e.entry_date), recovery: Math.round(Number(e.recovery)), notes };
  };
  let best: DayNote | null = null;
  let worst: DayNote | null = null;
  if (recDays.length >= 2) {
    const hi = recDays.reduce((a, b) => (Number(b.recovery) > Number(a.recovery) ? b : a));
    const lo = recDays.reduce((a, b) => (Number(b.recovery) < Number(a.recovery) ? b : a));
    if (hi.entry_date !== lo.entry_date) { best = noteFor(hi); worst = noteFor(lo); }
  }

  let eveningCheckIns = 0;
  let mealDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDate(start, i);
    const h = habits.get(d);
    if (h && hasEveningLog(h)) eveningCheckIns++;
    if ((meals.get(d)?.kcal ?? 0) > 0) mealDays++;
  }

  return { start, end, headline: headlineFor(metrics), metrics, best, worst, logging: { eveningCheckIns, mealDays, days: 7 } };
}

function headlineFor(metrics: WeeklyMetric[]): string {
  const m = (k: WeeklyMetricKey) => metrics.find((x) => x.key === k)!;
  const rec = m("recovery");
  if (rec.thisWeek == null) return "Not enough recovery data this week for a summary yet.";
  const base = `Recovery averaged ${rec.thisText} this week`;
  if (rec.lastWeek == null) return `${base}.`;
  const recPart = rec.better == null ? `${base}, about the same as the week before` : `${base}, ${rec.better ? "up" : "down"} ${rec.deltaText!.slice(1)} on the week before`;

  // Point at the clearest supporting change, if any.
  const drivers = (["sleep_hours", "hrv", "strain"] as WeeklyMetricKey[])
    .map(m)
    .filter((x) => x.deltaText && x.thisWeek != null && x.lastWeek != null && Math.abs(x.thisWeek - x.lastWeek) >= CFG[x.key].notable);
  if (!drivers.length) return `${recPart}.`;
  const d = drivers[0];
  const what = d.key === "sleep_hours" ? `sleep ${d.deltaText!.startsWith("+") ? "up" : "down"} ${d.deltaText!.slice(1)} a night`
    : d.key === "hrv" ? `HRV ${d.deltaText!.startsWith("+") ? "up" : "down"} ${d.deltaText!.slice(1)}`
    : `strain ${d.deltaText!.startsWith("+") ? "up" : "down"} ${d.deltaText!.slice(1)}`;
  return `${recPart}, with ${what}.`;
}

/** Loads the last 14 days and builds the summary for the week ending `today` (the user's local date). */
export async function loadWeeklySummary(supabase: SupabaseClient<Database>, userId: string, today: string): Promise<WeeklySummary> {
  const since = shiftDate(today, -14);
  const [e, h, m] = await Promise.all([
    supabase.from("daily_entries").select("entry_date,recovery,hrv,rhr,sleep_hours").eq("user_id", userId).gte("entry_date", since).lte("entry_date", today),
    supabase.from("habits_log")
      .select("entry_date,drinks,hydration,last_caffeine_time,last_meal_time,work_location,strain,supplements,note")
      .eq("user_id", userId).gte("entry_date", since).lte("entry_date", today),
    supabase.from("meals").select("entry_date,kcal,protein_g").eq("user_id", userId).gte("entry_date", since).lte("entry_date", today),
  ]);
  for (const r of [e, h, m]) if (r.error) throw r.error;
  const totals = new Map<string, WeeklyMealDay>();
  for (const row of (m.data ?? []) as { entry_date: string; kcal: number | null; protein_g: number | null }[]) {
    const t = totals.get(row.entry_date) ?? { entry_date: row.entry_date, kcal: 0, protein_g: 0 };
    t.kcal += Number(row.kcal ?? 0);
    t.protein_g += Number(row.protein_g ?? 0);
    totals.set(row.entry_date, t);
  }
  return buildWeeklySummary({
    today,
    entries: (e.data ?? []) as WeeklyEntry[],
    habits: (h.data ?? []) as HabitInsightRow[],
    mealDays: [...totals.values()],
  });
}
