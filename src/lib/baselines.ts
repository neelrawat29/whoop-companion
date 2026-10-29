// Personal baselines shared by web Insights and the iPhone
// (/api/public/ios/baselines). Each day is compared with the user's own
// usual range — the mean ± 1 standard deviation of the previous 30 days —
// because absolute HRV / resting HR values vary a lot between people.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BaselineMetric = "hrv" | "rhr" | "sleep_hours";
export type BaselineStatus = "below" | "within" | "above";

export type BaselineEntry = { entry_date: string; hrv: number | null; rhr: number | null; sleep_hours: number | null };

export type BaselinePoint = { date: string; value: number; low: number | null; high: number | null };

export type MetricBaseline = {
  metric: BaselineMetric;
  label: string;
  unit: string;
  latest: { date: string; value: number; text: string } | null;
  /** Usual range for the latest day; null until there's enough history. */
  range: { low: number; high: number; mean: number; text: string } | null;
  status: BaselineStatus | null;
  /** Consecutive recorded days (ending on the latest) with the same status. */
  streak: number;
  /** True when the latest status is the unwanted direction for this metric. */
  concerning: boolean;
  /** One plain-language line, e.g. "HRV is below your usual range for the 3rd day running." */
  summary: string;
  /** Last 30 days with each day's own usual range, for charting. */
  series: BaselinePoint[];
};

export type Baselines = { metrics: MetricBaseline[]; windowDays: number; minDays: number };

export const BASELINE_WINDOW_DAYS = 30;
export const BASELINE_MIN_DAYS = 14;
const CHART_DAYS = 30;

const hm = (v: number) => { const m = Math.round(v * 60); return `${Math.floor(m / 60)}h ${m % 60}m`; };

// `round` is the precision values are shown at; status is judged on rounded
// numbers so the label never contradicts what's on screen.
const CFG: Record<BaselineMetric, { label: string; unit: string; lowIsBad: boolean; round: (v: number) => number; fmt: (v: number) => string; fmtRange: (lo: number, hi: number) => string }> = {
  hrv: { label: "HRV", unit: "ms", lowIsBad: true, round: Math.round, fmt: (v) => `${Math.round(v)} ms`, fmtRange: (lo, hi) => `${Math.round(lo)}–${Math.round(hi)} ms` },
  rhr: { label: "Resting heart rate", unit: "bpm", lowIsBad: false, round: Math.round, fmt: (v) => `${Math.round(v)} bpm`, fmtRange: (lo, hi) => `${Math.round(lo)}–${Math.round(hi)} bpm` },
  sleep_hours: { label: "Sleep", unit: "h", lowIsBad: true, round: (v) => Math.round(v * 60) / 60, fmt: hm, fmtRange: (lo, hi) => `${hm(lo)}–${hm(hi)}` },
};

function shiftDate(d: string, days: number): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** Usual range from values recorded in the 30 days before `date` (not including it). */
export function rangeBefore(values: Map<string, number>, date: string, windowDays = BASELINE_WINDOW_DAYS, minDays = BASELINE_MIN_DAYS) {
  const xs: number[] = [];
  for (let i = 1; i <= windowDays; i++) {
    const v = values.get(shiftDate(date, -i));
    if (v != null) xs.push(v);
  }
  if (xs.length < minDays) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
  return { mean, low: mean - sd, high: mean + sd };
}

function statusOf(metric: BaselineMetric, v: number, r: { low: number; high: number }): BaselineStatus {
  const { round } = CFG[metric];
  const x = round(v);
  return x < round(r.low) ? "below" : x > round(r.high) ? "above" : "within";
}

export function computeMetricBaseline(metric: BaselineMetric, entries: BaselineEntry[], today?: string): MetricBaseline {
  const cfg = CFG[metric];
  const values = new Map<string, number>();
  for (const e of entries) {
    const v = e[metric];
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) values.set(e.entry_date, Number(v));
  }
  const dates = [...values.keys()].sort();
  const base: MetricBaseline = {
    metric, label: cfg.label, unit: cfg.unit, latest: null, range: null, status: null,
    streak: 0, concerning: false, summary: "", series: [],
  };
  if (!dates.length) {
    base.summary = `No ${cfg.label === "HRV" ? "HRV" : cfg.label.toLowerCase()} data yet.`;
    return base;
  }

  const last = dates[dates.length - 1];
  const end = today && today > last ? today : last;
  const start = shiftDate(end, -(CHART_DAYS - 1));
  base.series = dates.filter((d) => d >= start).map((d) => {
    const r = rangeBefore(values, d);
    return { date: d, value: values.get(d)!, low: r?.low ?? null, high: r?.high ?? null };
  });

  const latestValue = values.get(last)!;
  base.latest = { date: last, value: latestValue, text: cfg.fmt(latestValue) };
  const r = rangeBefore(values, last);
  const name = cfg.label === "HRV" ? "HRV" : cfg.label.toLowerCase();
  if (!r) {
    const have = dates.filter((d) => d < last && d >= shiftDate(last, -BASELINE_WINDOW_DAYS)).length;
    base.summary = `Your usual ${name} range appears after ${BASELINE_MIN_DAYS} days of data (${have} so far).`;
    return base;
  }
  base.range = { ...r, text: cfg.fmtRange(r.low, r.high) };
  base.status = statusOf(metric, latestValue, r);
  base.concerning = base.status === (cfg.lowIsBad ? "below" : "above");

  // Count back over recorded days while the status matches.
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const rr = rangeBefore(values, dates[i]);
    if (!rr || statusOf(metric, values.get(dates[i])!, rr) !== base.status) break;
    streak++;
  }
  base.streak = streak;

  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  const run = streak >= 2 ? ` for the ${ordinal(streak)} day running` : "";
  base.summary =
    base.status === "within"
      ? `${Name} is within your usual range${run}.`
      : `${Name} is ${base.status} your usual range${run}.`;
  return base;
}

export function computeBaselines(entries: BaselineEntry[], today?: string): Baselines {
  return {
    metrics: (["hrv", "rhr", "sleep_hours"] as BaselineMetric[]).map((m) => computeMetricBaseline(m, entries, today)),
    windowDays: BASELINE_WINDOW_DAYS,
    minDays: BASELINE_MIN_DAYS,
  };
}

/** Loads enough history for 30 charted days, each with its own 30-day baseline. */
export async function loadBaselines(supabase: SupabaseClient<Database>, userId: string, today?: string): Promise<Baselines> {
  const since = new Date(Date.now() - (CHART_DAYS + BASELINE_WINDOW_DAYS + 2) * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_entries")
    .select("entry_date,hrv,rhr,sleep_hours")
    .eq("user_id", userId)
    .gte("entry_date", since);
  if (error) throw error;
  return computeBaselines((data ?? []) as BaselineEntry[], today);
}
