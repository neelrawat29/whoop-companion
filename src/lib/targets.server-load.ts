// Shared profile + wearable-burn loader for target computation (web server fn and iOS route).
import { computeTargets, measuredTdee, type ActivityLevel, type Goal, type GoalPace, type Sex } from "./targets.shared";

/** Median WHOOP burn over the last 14 completed days (today excluded, it's partial). */
export async function loadMeasuredTdee(supabase: any, userId: string): Promise<number | null> {
  const today = new Date();
  const from = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("habits_log")
    .select("kcal_burned")
    .eq("user_id", userId)
    .gte("entry_date", from)
    .lt("entry_date", to);
  return measuredTdee((data ?? []).map((r: { kcal_burned: number | null }) => r.kcal_burned));
}

export function computeFromProfile(p: Record<string, unknown>, birth_year: number | null, measured: number | null) {
  return computeTargets({
    sex: p.sex as Sex,
    height_cm: (p.height_cm as number | null) ?? null,
    weight_kg: (p.weight_kg as number | null) ?? null,
    birth_year,
    activity_level: p.activity_level as ActivityLevel,
    goal: p.goal as Goal,
    goal_pace: (p.goal_pace as GoalPace) ?? "standard",
    measured_tdee: measured,
  });
}
