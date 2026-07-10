// Shared daily-target computation (Mifflin–St Jeor + activity multiplier + goal adjustment).
// Used by web server fns and iOS-facing routes so the numbers are identical everywhere.

export type Sex = "male" | "female" | "other" | null | undefined;
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active" | null | undefined;
export type Goal = "lose" | "maintain" | "gain" | null | undefined;

export interface TargetInput {
  sex: Sex;
  height_cm: number | null | undefined;
  weight_kg: number | null | undefined;
  birth_year: number | null | undefined;
  activity_level: ActivityLevel;
  goal: Goal;
}

export interface DailyTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sleep_hours: number;
}

const ACTIVITY_MULT: Record<NonNullable<ActivityLevel>, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTA_KCAL: Record<NonNullable<Goal>, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

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
  const tdee = bmr * mult;
  const delta = GOAL_DELTA_KCAL[(goal as NonNullable<Goal>) ?? "maintain"] ?? 0;
  const kcal = Math.max(1200, Math.round(tdee + delta));

  // Macros: protein 1.8 g/kg, fat 25% kcal, rest carbs
  const protein_g = Math.round(weight_kg * 1.8);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));

  return { kcal, protein_g, carbs_g, fat_g, sleep_hours: 8 };
}

export const DEFAULT_SLEEP_HOURS = 8;
