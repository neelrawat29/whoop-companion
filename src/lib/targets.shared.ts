// Shared daily-target computation (Mifflin–St Jeor + activity multiplier + goal adjustment).
// Used by web server fns and iOS-facing routes so the numbers are identical everywhere.

export type Sex = "male" | "female" | "other" | null | undefined;
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active" | null | undefined;
export type Goal = "lose" | "maintain" | "gain" | null | undefined;

export type GoalPace = "gentle" | "standard" | "aggressive" | null | undefined;

export interface TargetInput {
  sex: Sex;
  height_cm: number | null | undefined;
  weight_kg: number | null | undefined;
  birth_year: number | null | undefined;
  activity_level: ActivityLevel;
  goal: Goal;
  /** How fast to lose/gain. Defaults to "standard". */
  goal_pace?: GoalPace;
  /** Measured daily energy burn (e.g. median of recent WHOOP days). Replaces the formula estimate when present. */
  measured_tdee?: number | null;
}

export interface DailyTargets {
  kcal: number;
  /** Daily energy-burn goal = maintenance energy (measured from the wearable when available). */
  burn_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sleep_hours: number;
  /** Where maintenance energy came from. */
  tdee_source: "wearable" | "formula";
  /** Signed daily kcal difference between eaten and burned. */
  delta_kcal: number;
}

const ACTIVITY_MULT: Record<NonNullable<ActivityLevel>, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Fat loss: % of body weight per week. */
const LOSS_PCT_PER_WEEK: Record<NonNullable<GoalPace>, number> = { gentle: 0.0025, standard: 0.005, aggressive: 0.0075 };
/** Max deficit as share of maintenance (protects recovery and lean mass). */
const LOSS_MAX_SHARE: Record<NonNullable<GoalPace>, number> = { gentle: 0.15, standard: 0.22, aggressive: 0.28 };
/** Muscle gain: surplus as share of maintenance. */
const GAIN_SHARE: Record<NonNullable<GoalPace>, number> = { gentle: 0.05, standard: 0.1, aggressive: 0.15 };
const KCAL_PER_KG_FAT = 7700;

/** Minimum days of wearable burn data (in the window) needed to trust it over the formula. */
export const MIN_MEASURED_DAYS = 7;

/** Median of valid daily burn readings, or null when there aren't enough. */
export function measuredTdee(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && x >= 1000 && x <= 8000).sort((a, b) => a - b);
  if (v.length < MIN_MEASURED_DAYS) return null;
  const m = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
}

/** Compute reasonable daily targets. Returns null when inputs are insufficient. */
export function computeTargets(input: TargetInput): DailyTargets | null {
  const { sex, height_cm, weight_kg, birth_year, activity_level, goal } = input;
  if (!sex || !height_cm || !weight_kg || !birth_year) return null;

  const age = new Date().getFullYear() - birth_year;
  if (age < 10 || age > 100) return null;

  // Mifflin–St Jeor BMR
  const bmr =
    sex === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const mult = ACTIVITY_MULT[(activity_level as NonNullable<ActivityLevel>) ?? "moderate"] ?? 1.55;
  const measured = input.measured_tdee && input.measured_tdee > 0 ? input.measured_tdee : null;
  const tdee = measured ?? bmr * mult;
  const pace = (input.goal_pace ?? "standard") as NonNullable<GoalPace>;

  let delta = 0;
  if (goal === "lose") {
    const weekly = weight_kg * LOSS_PCT_PER_WEEK[pace] * KCAL_PER_KG_FAT;
    delta = -Math.min(weekly / 7, tdee * LOSS_MAX_SHARE[pace]);
  } else if (goal === "gain") {
    delta = tdee * GAIN_SHARE[pace];
  }
  const floor = sex === "male" ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round(tdee + delta));

  // Macros: protein 1.8 g/kg, fat 25% kcal, rest carbs
  const protein_g = Math.round(weight_kg * 1.8);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const burn_kcal = Math.round(tdee);

  return {
    kcal, burn_kcal, protein_g, carbs_g, fat_g, sleep_hours: 8,
    tdee_source: measured ? "wearable" : "formula",
    delta_kcal: kcal - burn_kcal,
  };
}

export const DEFAULT_SLEEP_HOURS = 8;

// ---------------------------------------------------------------------------
// Hydration target: body-weight baseline + bonus for training strain.
// Mirrored in iOS `WaterTarget.swift` — keep both in sync.
export interface WaterTarget {
  targetMl: number;
  baselineMl: number;
  strainBonusMl: number;
}

export function computeWaterTarget(input: {
  weight_kg?: number | null;
  sex?: Sex;
  strain?: number | null;
}): WaterTarget {
  const w = Number(input.weight_kg) || 0;
  const perKg = input.sex === "male" ? 35 : 31;
  const baselineRaw = w > 30 ? w * perKg : 2500;
  const baselineMl = Math.round(baselineRaw / 50) * 50;
  const s = Math.max(0, Math.min(21, Number(input.strain) || 0));
  const strainBonusMl = Math.round((s * 60) / 50) * 50;
  const targetMl = Math.max(1500, Math.min(6000, baselineMl + strainBonusMl));
  return { targetMl, baselineMl, strainBonusMl };
}

export const WATER_QUICK_ADDS = [
  { ml: 250, label: "Glass" },
  { ml: 500, label: "Bottle" },
  { ml: 750, label: "Shaker" },
] as const;
