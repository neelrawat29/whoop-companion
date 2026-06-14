import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  scoreBiologicalAge,
  type BioAgeResult,
  type DailyEntry,
  type HabitsLog,
  type MealRow,
  type ProfileBaseline,
} from "./biological-age";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function loadWindow(
  supabase: any,
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<{ entries: DailyEntry[]; habits: HabitsLog[]; meals: MealRow[] }> {
  const [e, h, m] = await Promise.all([
    supabase
      .from("daily_entries")
      .select("entry_date,recovery,hrv,rhr,sleep_hours")
      .eq("user_id", userId)
      .gte("entry_date", fromIso)
      .lte("entry_date", toIso),
    supabase
      .from("habits_log")
      .select("entry_date,bedtime,drinks,hydration,energy,mood")
      .eq("user_id", userId)
      .gte("entry_date", fromIso)
      .lte("entry_date", toIso),
    supabase
      .from("meals")
      .select("entry_date,kcal,protein_g")
      .eq("user_id", userId)
      .gte("entry_date", fromIso)
      .lte("entry_date", toIso),
  ]);
  return {
    entries: (e.data ?? []) as DailyEntry[],
    habits: (h.data ?? []) as HabitsLog[],
    meals: (m.data ?? []) as MealRow[],
  };
}

async function loadProfile(supabase: any, userId: string): Promise<ProfileBaseline> {
  const { data } = await supabase
    .from("profiles")
    .select("date_of_birth,sex,height_cm,weight_kg,resting_hr_baseline")
    .eq("id", userId)
    .maybeSingle();
  return {
    date_of_birth: data?.date_of_birth ?? null,
    sex: (data?.sex ?? null) as ProfileBaseline["sex"],
    height_cm: data?.height_cm != null ? Number(data.height_cm) : null,
    weight_kg: data?.weight_kg != null ? Number(data.weight_kg) : null,
    resting_hr_baseline: data?.resting_hr_baseline ?? null,
  };
}

export const getBiologicalAge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BioAgeResult> => {
    const { supabase, userId } = context;
    const profile = await loadProfile(supabase, userId);
    const from = isoDaysAgo(30);
    const to = isoDaysAgo(0);
    const win = await loadWindow(supabase, userId, from, to);
    return scoreBiologicalAge({ profile, ...win });
  });

export type HistoryPoint = {
  date: string;
  biological: number | null;
  chronological: number | null;
  delta: number | null;
};

export const getBiologicalAgeHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HistoryPoint[]> => {
    const { supabase, userId } = context;
    const profile = await loadProfile(supabase, userId);
    // Load the full 120-day pool once, then slide a 30-day window per day for 90 points.
    const from = isoDaysAgo(120);
    const to = isoDaysAgo(0);
    const pool = await loadWindow(supabase, userId, from, to);

    const points: HistoryPoint[] = [];
    for (let i = 89; i >= 0; i--) {
      const windowEnd = new Date();
      windowEnd.setUTCHours(0, 0, 0, 0);
      windowEnd.setUTCDate(windowEnd.getUTCDate() - i);
      const windowStart = new Date(windowEnd);
      windowStart.setUTCDate(windowStart.getUTCDate() - 30);
      const endIso = windowEnd.toISOString().slice(0, 10);
      const startIso = windowStart.toISOString().slice(0, 10);

      const inRange = (d: string) => d >= startIso && d <= endIso;
      const res = scoreBiologicalAge({
        profile,
        entries: pool.entries.filter((e) => inRange(e.entry_date)),
        habits: pool.habits.filter((h) => inRange(h.entry_date)),
        meals: pool.meals.filter((m) => inRange(m.entry_date)),
        now: windowEnd,
      });
      points.push({
        date: endIso,
        biological: res.ready ? res.biological : null,
        chronological: res.chronological,
        delta: res.ready ? res.delta : null,
      });
    }
    return points;
  });
