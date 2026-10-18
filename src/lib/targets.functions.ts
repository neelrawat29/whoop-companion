import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SLEEP_HOURS, type ActivityLevel, type DailyTargets, type Goal, type GoalPace, type Sex } from "./targets.shared";
import { computeFromProfile, loadMeasuredTdee } from "./targets.server-load";

export interface TargetsPayload {
  sex: Sex;
  height_cm: number | null;
  weight_kg: number | null;
  birth_year: number | null;
  activity_level: ActivityLevel;
  goal: Goal;
  goal_pace: NonNullable<GoalPace>;
  kcal_target: number | null;
  kcal_burn_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  sleep_target_hours: number | null;
  computed: DailyTargets | null;
}

async function loadProfile(supabase: any, userId: string): Promise<TargetsPayload> {
  const [{ data }, measured] = await Promise.all([
    supabase
      .from("profiles")
      .select("sex,height_cm,weight_kg,date_of_birth,activity_level,goal,goal_pace,kcal_target,kcal_burn_target,protein_target,carbs_target,fat_target,sleep_target_hours,birth_year")
      .eq("id", userId)
      .maybeSingle(),
    loadMeasuredTdee(supabase, userId),
  ]);

  const p = (data ?? {}) as Record<string, unknown>;
  const birth_year =
    (p.birth_year as number | null) ??
    (p.date_of_birth ? new Date(p.date_of_birth as string).getFullYear() : null);

  const computed = computeFromProfile(p, birth_year, measured);

  return {
    sex: (p.sex as Sex) ?? null,
    height_cm: (p.height_cm as number | null) ?? null,
    weight_kg: (p.weight_kg as number | null) ?? null,
    birth_year,
    activity_level: (p.activity_level as ActivityLevel) ?? null,
    goal: (p.goal as Goal) ?? null,
    goal_pace: ((p.goal_pace as GoalPace) ?? "standard") as NonNullable<GoalPace>,
    kcal_target: (p.kcal_target as number | null) ?? null,
    kcal_burn_target: (p.kcal_burn_target as number | null) ?? null,
    protein_target: (p.protein_target as number | null) ?? null,
    carbs_target: (p.carbs_target as number | null) ?? null,
    fat_target: (p.fat_target as number | null) ?? null,
    sleep_target_hours: (p.sleep_target_hours as number | null) ?? DEFAULT_SLEEP_HOURS,
    computed,
  };
}

export const getMyTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadProfile(context.supabase, context.userId));

export interface SaveTargetsInput {
  sex?: Sex;
  height_cm?: number | null;
  birth_year?: number | null;
  activity_level?: ActivityLevel;
  goal?: Goal;
  goal_pace?: GoalPace;
  kcal_target?: number | null;
  kcal_burn_target?: number | null;
  protein_target?: number | null;
  carbs_target?: number | null;
  fat_target?: number | null;
  sleep_target_hours?: number | null;
  autoCompute?: boolean;
}

const PACES = ["gentle", "standard", "aggressive"];

export const saveMyTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => v as SaveTargetsInput)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.sex !== undefined) patch.sex = data.sex || null;
    if (data.height_cm !== undefined) patch.height_cm = data.height_cm;
    if (data.birth_year !== undefined) patch.birth_year = data.birth_year;
    if (data.activity_level !== undefined) patch.activity_level = data.activity_level || null;
    if (data.goal !== undefined) patch.goal = data.goal || null;
    if (data.goal_pace && PACES.includes(data.goal_pace)) patch.goal_pace = data.goal_pace;
    if (data.kcal_target !== undefined) patch.kcal_target = data.kcal_target;
    if (data.kcal_burn_target !== undefined) patch.kcal_burn_target = data.kcal_burn_target;
    if (data.protein_target !== undefined) patch.protein_target = data.protein_target;
    if (data.carbs_target !== undefined) patch.carbs_target = data.carbs_target;
    if (data.fat_target !== undefined) patch.fat_target = data.fat_target;
    if (data.sleep_target_hours !== undefined) patch.sleep_target_hours = data.sleep_target_hours;

    if (data.autoCompute) {
      const current = await loadProfile(context.supabase, context.userId);
      const measured = current.computed?.tdee_source === "wearable" ? current.computed.burn_kcal : null;
      const t = computeFromProfile(
        {
          sex: (patch.sex as Sex) ?? current.sex,
          height_cm: (patch.height_cm as number | null) ?? current.height_cm,
          weight_kg: current.weight_kg,
          activity_level: (patch.activity_level as ActivityLevel) ?? current.activity_level,
          goal: (patch.goal as Goal) ?? current.goal,
          goal_pace: (patch.goal_pace as GoalPace) ?? current.goal_pace,
        },
        (patch.birth_year as number | null) ?? current.birth_year,
        measured,
      );
      if (t) {
        patch.kcal_target = t.kcal;
        patch.kcal_burn_target = t.burn_kcal;
        patch.protein_target = t.protein_g;
        patch.carbs_target = t.carbs_g;
        patch.fat_target = t.fat_g;
        patch.sleep_target_hours = t.sleep_hours;
      }
    }

    if (Object.keys(patch).length > 0) {
      await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    }
    return loadProfile(context.supabase, context.userId);
  });
