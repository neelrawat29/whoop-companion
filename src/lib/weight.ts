// Pure helpers for weight tracking — unit conversion, moving average, trend/ETA.

export type WeightUnit = "kg" | "lbs";
export type WeightEntry = { entry_date: string; weight_kg: number };

export const KG_PER_LB = 0.45359237;

export function toDisplay(weightKg: number | null | undefined, unit: WeightUnit): number | null {
  if (weightKg == null) return null;
  return unit === "kg" ? weightKg : weightKg / KG_PER_LB;
}

export function fromDisplay(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function unitLabel(unit: WeightUnit) {
  return unit === "kg" ? "kg" : "lb";
}

export function fmtWeight(weightKg: number | null | undefined, unit: WeightUnit, digits = 1): string {
  const v = toDisplay(weightKg, unit);
  if (v == null) return "—";
  return `${v.toFixed(digits)} ${unitLabel(unit)}`;
}

export function fmtDelta(deltaKg: number, unit: WeightUnit, digits = 1): string {
  const v = unit === "kg" ? deltaKg : deltaKg / KG_PER_LB;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)} ${unitLabel(unit)}`;
}

// 7-day moving average aligned to entries asc by date.
export function movingAverage(entries: WeightEntry[], window = 7): (number | null)[] {
  if (entries.length === 0) return [];
  // Build a date->weight map and walk by day to handle gaps.
  const byDate = new Map(entries.map((e) => [e.entry_date, e.weight_kg]));
  return entries.map((e) => {
    const end = parseDate(e.entry_date);
    const vals: number[] = [];
    for (let i = 0; i < window; i++) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const iso = fmtISO(d);
      const v = byDate.get(iso);
      if (v != null) vals.push(v);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Linear regression on last `days` entries. Returns kg/day slope.
export function trendKgPerDay(entries: WeightEntry[], days = 14): number | null {
  if (entries.length < 3) return null;
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = sorted.filter((e) => parseDate(e.entry_date) >= cutoff);
  const sample = recent.length >= 3 ? recent : sorted.slice(-Math.max(3, days));
  if (sample.length < 3) return null;
  const t0 = parseDate(sample[0].entry_date).getTime();
  const xs = sample.map((e) => (parseDate(e.entry_date).getTime() - t0) / 86400000);
  const ys = sample.map((e) => e.weight_kg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export type ProgressInfo = {
  startKg: number | null;
  currentKg: number | null;
  goalKg: number | null;
  deltaFromStartKg: number; // positive = gained, negative = lost
  toGoalKg: number; // positive = still need to lose, negative = past goal (if losing)
  progressPct: number; // 0..100 of journey from start to goal
  trendKgPerDay: number | null;
  etaDate: string | null; // YYYY-MM-DD or null
  status: "on-track" | "off-track" | "stalled" | "achieved" | "no-goal" | "no-data";
};

export function computeProgress(
  entries: WeightEntry[],
  goalKg: number | null,
  goalDate: string | null,
): ProgressInfo {
  if (entries.length === 0) {
    return {
      startKg: null,
      currentKg: null,
      goalKg,
      deltaFromStartKg: 0,
      toGoalKg: 0,
      progressPct: 0,
      trendKgPerDay: null,
      etaDate: null,
      status: "no-data",
    };
  }
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const startKg = sorted[0].weight_kg;
  const currentKg = sorted[sorted.length - 1].weight_kg;
  const deltaFromStartKg = currentKg - startKg;
  const slope = trendKgPerDay(entries);

  if (goalKg == null) {
    return {
      startKg,
      currentKg,
      goalKg: null,
      deltaFromStartKg,
      toGoalKg: 0,
      progressPct: 0,
      trendKgPerDay: slope,
      etaDate: null,
      status: "no-goal",
    };
  }

  const toGoalKg = currentKg - goalKg; // remaining to lose (positive) or gain (negative)
  const totalJourney = startKg - goalKg; // positive if losing
  const done = startKg - currentKg;
  const progressPct = totalJourney === 0 ? 100 : Math.max(0, Math.min(100, (done / totalJourney) * 100));

  // Achieved if within 0.2 kg of goal in the right direction.
  if (Math.abs(toGoalKg) < 0.2) {
    return { startKg, currentKg, goalKg, deltaFromStartKg, toGoalKg, progressPct: 100, trendKgPerDay: slope, etaDate: null, status: "achieved" };
  }

  // ETA: only meaningful if trend points toward goal.
  let etaDate: string | null = null;
  let status: ProgressInfo["status"] = "stalled";
  const losingGoal = totalJourney > 0; // user wants to lose
  if (slope != null && Math.abs(slope) > 0.005) {
    const towardGoal = (losingGoal && slope < 0) || (!losingGoal && slope > 0);
    if (towardGoal) {
      const daysNeeded = Math.abs(toGoalKg / slope);
      if (daysNeeded < 365 * 5) {
        const eta = new Date();
        eta.setDate(eta.getDate() + Math.round(daysNeeded));
        etaDate = fmtISO(eta);
        if (goalDate) {
          status = parseDate(etaDate) <= parseDate(goalDate) ? "on-track" : "off-track";
        } else {
          status = "on-track";
        }
      } else {
        status = "stalled";
      }
    } else {
      status = "off-track";
    }
  }

  return { startKg, currentKg, goalKg, deltaFromStartKg, toGoalKg, progressPct, trendKgPerDay: slope, etaDate, status };
}

export function filterRange(entries: WeightEntry[], range: "1M" | "3M" | "6M" | "1Y" | "ALL"): WeightEntry[] {
  if (range === "ALL") return entries;
  const days = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[range];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return entries.filter((e) => parseDate(e.entry_date) >= cutoff);
}
