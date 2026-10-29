// Habit → next-morning analysis shared by the web Insights page and the
// iPhone (/api/public/ios/habit-insights), so both show the same findings.
//
// Timing: evening habits are logged on the day they happen (date D), while
// recovery, HRV, resting HR and sleep for the night after are stored on D+1.
// So each habit on D is compared with outcomes on D+1.
//
// Bedtime is left out on purpose: WHOOP fills it on the wake-up date while
// the Evening check-in saves it on the evening date, and rows don't record
// which source wrote it, so pairing it with a night would be unreliable.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type HabitInsightRow = {
  entry_date: string;
  drinks: number | null;
  hydration: number | null;
  last_caffeine_time: string | null;
  last_meal_time: string | null;
  work_location: string | null;
  strain: number | null;
  supplements: string[] | null;
  note: string | null;
};

export type OutcomeRow = {
  entry_date: string;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  sleep_hours: number | null;
};

export type MealDay = { entry_date: string; kcal: number; protein_g: number };

export type Targets = { kcal_target: number | null; protein_target: number | null };

export type Outcome = "recovery" | "hrv" | "rhr" | "sleep_hours";
export type Confidence = "early" | "likely" | "consistent";

export type OutcomeEffect = {
  outcome: Outcome;
  withAvg: number;
  withoutAvg: number;
  delta: number;
  nWith: number;
  nWithout: number;
  confidence: Confidence;
  /** Difference is big enough to matter for this outcome. */
  notable: boolean;
  /** The habit days look better for this outcome. */
  better: boolean;
  /** Ready-to-show change, e.g. "−12 pts", "+25 min". */
  deltaText: string;
};

export type HabitFinding = {
  id: string;
  /** Short name, e.g. "1+ drinks". */
  label: string;
  /** Plain-language summary of the main result. */
  sentence: string;
  primary: OutcomeEffect;
  /** Other outcomes that also moved clearly (likely or consistent). */
  also: OutcomeEffect[];
};

export type HabitInsights = {
  /** Findings with a notable difference, strongest first. */
  findings: HabitFinding[];
  /** Habits with enough data but no clear difference yet. */
  noClearLink: string[];
  /** Nights where an evening log could be matched to the next morning. */
  pairedNights: number;
  windowDays: number;
};

export const HABIT_WINDOW_DAYS = 120;
const MIN_PER_SIDE = 3;

const OUTCOMES: Record<Outcome, { name: string; higherIsBetter: boolean; notable: number; fmt: (v: number) => string; fmtDelta: (d: number) => string }> = {
  recovery: {
    name: "recovery",
    higherIsBetter: true,
    notable: 3,
    fmt: (v) => `${Math.round(v)}%`,
    fmtDelta: (d) => `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d))} pts`,
  },
  hrv: {
    name: "HRV",
    higherIsBetter: true,
    notable: 3,
    fmt: (v) => `${Math.round(v)} ms`,
    fmtDelta: (d) => `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d))} ms`,
  },
  rhr: {
    name: "resting heart rate",
    higherIsBetter: false,
    notable: 1.5,
    fmt: (v) => `${Math.round(v)} bpm`,
    fmtDelta: (d) => `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} bpm`,
  },
  sleep_hours: {
    name: "sleep",
    higherIsBetter: true,
    notable: 0.25,
    fmt: (v) => { const m = Math.round(v * 60); return `${Math.floor(m / 60)}h ${m % 60}m`; },
    fmtDelta: (d) => `${d > 0 ? "+" : "−"}${Math.round(Math.abs(d) * 60)} min`,
  },
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  recovery: "Recovery",
  hrv: "HRV",
  rhr: "Resting HR",
  sleep_hours: "Sleep",
};

export function nextDate(d: string): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/** Minutes after midnight for "HH:MM[:SS]"; times before 05:00 count as late night (+24h). */
export function lateMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins < 5 * 60 ? mins + 24 * 60 : mins;
}

/** True when the row shows the user actually did an evening check-in (not just a WHOOP strain fill). */
export function hasEveningLog(h: HabitInsightRow): boolean {
  return (
    (h.drinks ?? 0) > 0 ||
    (h.hydration ?? 0) > 0 ||
    !!h.last_caffeine_time ||
    !!h.last_meal_time ||
    !!h.work_location ||
    !!(h.note && h.note.trim()) ||
    (h.supplements?.length ?? 0) > 0
  );
}

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function variance(xs: number[], m: number) {
  return xs.length < 2 ? 0 : xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}

function confidenceFor(a: number[], b: number[], ma: number, mb: number): Confidence {
  const se = Math.sqrt(variance(a, ma) / a.length + variance(b, mb) / b.length);
  const t = se > 0 ? Math.abs(ma - mb) / se : Infinity;
  const nMin = Math.min(a.length, b.length);
  if (nMin >= 10 && t >= 3) return "consistent";
  if (nMin >= 6 && t >= 2.5) return "likely";
  return "early";
}

export function compareGroups(outcome: Outcome, withVals: number[], withoutVals: number[]): OutcomeEffect | null {
  if (withVals.length < MIN_PER_SIDE || withoutVals.length < MIN_PER_SIDE) return null;
  const withAvg = mean(withVals);
  const withoutAvg = mean(withoutVals);
  const delta = withAvg - withoutAvg;
  const cfg = OUTCOMES[outcome];
  return {
    outcome,
    withAvg,
    withoutAvg,
    delta,
    nWith: withVals.length,
    nWithout: withoutVals.length,
    confidence: confidenceFor(withVals, withoutVals, withAvg, withoutAvg),
    notable: Math.abs(delta) >= cfg.notable,
    better: cfg.higherIsBetter ? delta > 0 : delta < 0,
    deltaText: cfg.fmtDelta(delta),
  };
}

function medianRounded(xs: number[], step: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return Math.max(step, Math.round(mid / step) * step);
}

type HabitDef = {
  id: string;
  label: string;
  /** "After 1+ drinks" — leads the sentence. */
  withPhrase: string;
  /** "evenings without" — closes the sentence. */
  withoutPhrase: string;
  /** true = habit day, false = comparison day, null = not counted. */
  classify: (date: string) => boolean | null;
};

const RANK: Record<Confidence, number> = { consistent: 3, likely: 2, early: 1 };

export function analyzeHabits(input: {
  habits: HabitInsightRow[];
  outcomes: OutcomeRow[];
  mealDays?: MealDay[];
  targets?: Targets | null;
  windowDays?: number;
}): HabitInsights {
  const byDate = new Map(input.habits.map((h) => [h.entry_date, h]));
  const outcomeByDate = new Map(input.outcomes.map((o) => [o.entry_date, o]));
  const meals = new Map((input.mealDays ?? []).map((m) => [m.entry_date, m]));
  const evening = (d: string) => { const h = byDate.get(d); return h && hasEveningLog(h) ? h : null; };

  const defs: HabitDef[] = [];

  defs.push({
    id: "alcohol",
    label: "1+ drinks",
    withPhrase: "After evenings with 1+ drinks",
    withoutPhrase: "evenings without",
    classify: (d) => { const h = evening(d); return h ? (h.drinks ?? 0) >= 1 : null; },
  });

  defs.push({
    id: "late-caffeine",
    label: "Caffeine after 2pm",
    withPhrase: "After caffeine past 2pm",
    withoutPhrase: "days you stopped earlier",
    classify: (d) => { const m = lateMinutes(byDate.get(d)?.last_caffeine_time ?? null); return m == null ? null : m >= 14 * 60; },
  });

  defs.push({
    id: "late-meal",
    label: "Last meal after 9pm",
    withPhrase: "After eating past 9pm",
    withoutPhrase: "evenings you ate earlier",
    classify: (d) => { const m = lateMinutes(byDate.get(d)?.last_meal_time ?? null); return m == null ? null : m >= 21 * 60; },
  });

  const hydrationVals = input.habits.map((h) => h.hydration ?? 0).filter((v) => v > 0);
  const waterCut = medianRounded(hydrationVals, 250);
  if (waterCut != null) {
    const litres = (waterCut / 1000).toFixed(waterCut % 1000 === 0 ? 0 : waterCut % 500 === 0 ? 1 : 2);
    defs.push({
      id: "water",
      label: `${litres} L+ water`,
      withPhrase: `After days with ${litres} L+ of water`,
      withoutPhrase: "days with less",
      classify: (d) => { const v = byDate.get(d)?.hydration ?? 0; return v > 0 ? v >= waterCut : null; },
    });
  }

  defs.push({
    id: "high-strain",
    label: "High-strain day (14+)",
    withPhrase: "After high-strain days (14+)",
    withoutPhrase: "lighter days",
    classify: (d) => { const s = byDate.get(d)?.strain; return s == null ? null : s >= 14; },
  });

  defs.push({
    id: "work-home",
    label: "Worked from home",
    withPhrase: "After working from home",
    withoutPhrase: "office days",
    classify: (d) => { const w = byDate.get(d)?.work_location; return w === "home" ? true : w === "office" ? false : null; },
  });

  // Meals: only days that look fully logged (≥ 1,000 kcal).
  const fullDay = (d: string) => { const m = meals.get(d); return m && m.kcal >= 1000 ? m : null; };
  const proteinTarget = input.targets?.protein_target ?? null;
  if (proteinTarget && proteinTarget > 0) {
    defs.push({
      id: "protein",
      label: `Hit protein (${Math.round(proteinTarget)} g)`,
      withPhrase: `After days you hit ${Math.round(proteinTarget)} g protein`,
      withoutPhrase: "days below it",
      classify: (d) => { const m = fullDay(d); return m ? m.protein_g >= proteinTarget : null; },
    });
  }
  const kcalTarget = input.targets?.kcal_target ?? null;
  if (kcalTarget && kcalTarget > 0) {
    defs.push({
      id: "under-eating",
      label: "Ate 20%+ under target",
      withPhrase: "After days you ate 20%+ under your calorie target",
      withoutPhrase: "days closer to target",
      classify: (d) => { const m = fullDay(d); return m ? m.kcal < kcalTarget * 0.8 : null; },
    });
  }

  // Supplements: compare among days where supplements were logged at all.
  const suppNames = new Set<string>();
  for (const h of input.habits) for (const s of h.supplements ?? []) suppNames.add(s);
  for (const name of suppNames) {
    defs.push({
      id: `supp:${name}`,
      label: `Took ${name}`,
      withPhrase: `After days you took ${name}`,
      withoutPhrase: "logged days without it",
      classify: (d) => { const s = byDate.get(d)?.supplements; return s && s.length ? s.includes(name) : null; },
    });
  }

  const pairedDates = new Set<string>();
  const findings: HabitFinding[] = [];
  const noClearLink: string[] = [];

  // Alcohol has a large effect of its own, so other habits are compared on
  // drink-free nights only; otherwise a habit that happens to coincide with
  // drinking would look like it hurts recovery.
  const drankThatEvening = (d: string) => (byDate.get(d)?.drinks ?? 0) > 0;

  for (const def of defs) {
    const groups: Record<Outcome, { w: number[]; wo: number[] }> = {
      recovery: { w: [], wo: [] }, hrv: { w: [], wo: [] }, rhr: { w: [], wo: [] }, sleep_hours: { w: [], wo: [] },
    };
    for (const h of input.habits) {
      const c = def.classify(h.entry_date);
      if (c == null) continue;
      if (def.id !== "alcohol" && drankThatEvening(h.entry_date)) continue;
      const o = outcomeByDate.get(nextDate(h.entry_date));
      if (!o) continue;
      pairedDates.add(h.entry_date);
      for (const k of Object.keys(groups) as Outcome[]) {
        const v = o[k];
        if (v == null) continue;
        (c ? groups[k].w : groups[k].wo).push(Number(v));
      }
    }
    const effects = (Object.keys(groups) as Outcome[])
      .map((k) => compareGroups(k, groups[k].w, groups[k].wo))
      .filter((e): e is OutcomeEffect => e != null);
    if (!effects.length) continue;

    const primary = effects.find((e) => e.outcome === "recovery") ?? effects.find((e) => e.outcome === "sleep_hours") ?? effects[0];
    const also = effects.filter((e) => e !== primary && e.notable && e.confidence !== "early");

    if (!primary.notable && !also.length) { noClearLink.push(def.label); continue; }

    const cfg = OUTCOMES[primary.outcome];
    const sentence = primary.notable
      ? `${def.withPhrase}, your ${cfg.name} averaged ${cfg.fmt(primary.withAvg)} vs ${cfg.fmt(primary.withoutAvg)} after ${def.withoutPhrase}.`
      : `${def.withPhrase}, your ${cfg.name} was about the same, but other signals moved.`;
    findings.push({ id: def.id, label: def.label, sentence, primary, also });
  }

  findings.sort((a, b) => {
    const strength = (f: HabitFinding) => (f.primary.notable ? RANK[f.primary.confidence] : 0);
    return strength(b) - strength(a) || Math.abs(b.primary.delta) - Math.abs(a.primary.delta);
  });

  return { findings, noClearLink, pairedNights: pairedDates.size, windowDays: input.windowDays ?? HABIT_WINDOW_DAYS };
}

/** Loads the last HABIT_WINDOW_DAYS of data with the caller's own (RLS-scoped) client and analyses it. */
export async function loadHabitInsights(supabase: SupabaseClient<Database>, userId: string): Promise<HabitInsights> {
  const since = new Date(Date.now() - HABIT_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const [h, e, m, p] = await Promise.all([
    supabase.from("habits_log")
      .select("entry_date,drinks,hydration,last_caffeine_time,last_meal_time,work_location,strain,supplements,note")
      .eq("user_id", userId).gte("entry_date", since),
    supabase.from("daily_entries").select("entry_date,recovery,hrv,rhr,sleep_hours").eq("user_id", userId).gte("entry_date", since),
    supabase.from("meals").select("entry_date,kcal,protein_g").eq("user_id", userId).gte("entry_date", since).limit(5000),
    supabase.from("profiles").select("kcal_target,protein_target").eq("id", userId).maybeSingle(),
  ]);
  for (const r of [h, e, m]) if (r.error) throw r.error;

  const mealTotals = new Map<string, MealDay>();
  for (const row of (m.data ?? []) as { entry_date: string; kcal: number | null; protein_g: number | null }[]) {
    const t = mealTotals.get(row.entry_date) ?? { entry_date: row.entry_date, kcal: 0, protein_g: 0 };
    t.kcal += Number(row.kcal ?? 0);
    t.protein_g += Number(row.protein_g ?? 0);
    mealTotals.set(row.entry_date, t);
  }

  return analyzeHabits({
    habits: (h.data ?? []) as HabitInsightRow[],
    outcomes: (e.data ?? []) as OutcomeRow[],
    mealDays: [...mealTotals.values()],
    targets: (p.data ?? null) as Targets | null,
  });
}
