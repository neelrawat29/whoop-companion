import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrendRange = 7 | 30 | 90;

export interface TrendPoint {
  date: string;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  sleep_hours: number | null;
  kcal: number | null;
  protein_g: number | null;
  weight_kg: number | null;
}

export interface TrendsPayload {
  range: TrendRange;
  points: TrendPoint[];
  averages: {
    recovery: number | null;
    hrv: number | null;
    sleep_hours: number | null;
    kcal: number | null;
    protein_g: number | null;
    weight_kg: number | null;
  };
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

async function buildTrends(supabase: any, userId: string, range: TrendRange): Promise<TrendsPayload> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (range - 1));
  const startIso = start.toISOString().slice(0, 10);

  const [entriesRes, mealsRes, weightsRes] = await Promise.all([
    supabase
      .from("daily_entries")
      .select("entry_date, recovery, hrv, rhr, sleep_hours")
      .eq("user_id", userId)
      .gte("entry_date", startIso)
      .order("entry_date"),
    supabase
      .from("meals")
      .select("entry_date, kcal, protein_g")
      .eq("user_id", userId)
      .gte("entry_date", startIso),
    supabase
      .from("weight_entries")
      .select("entry_date, weight_kg")
      .eq("user_id", userId)
      .gte("entry_date", startIso)
      .order("entry_date"),
  ]);

  const entries = (entriesRes.data ?? []) as Array<{ entry_date: string; recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null }>;
  const meals = (mealsRes.data ?? []) as Array<{ entry_date: string; kcal: number | null; protein_g: number | null }>;
  const weights = (weightsRes.data ?? []) as Array<{ entry_date: string; weight_kg: number | null }>;

  const mealMap = new Map<string, { kcal: number; protein_g: number }>();
  for (const m of meals) {
    const cur = mealMap.get(m.entry_date) ?? { kcal: 0, protein_g: 0 };
    cur.kcal += Number(m.kcal ?? 0);
    cur.protein_g += Number(m.protein_g ?? 0);
    mealMap.set(m.entry_date, cur);
  }
  const weightMap = new Map(weights.map((w) => [w.entry_date, w.weight_kg]));
  const entryMap = new Map(entries.map((e) => [e.entry_date, e]));

  const points: TrendPoint[] = [];
  for (let i = 0; i < range; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const e = entryMap.get(iso);
    const m = mealMap.get(iso);
    points.push({
      date: iso,
      recovery: e?.recovery ?? null,
      hrv: e?.hrv ?? null,
      rhr: e?.rhr ?? null,
      sleep_hours: e?.sleep_hours ?? null,
      kcal: m ? Math.round(m.kcal) : null,
      protein_g: m ? Math.round(m.protein_g) : null,
      weight_kg: weightMap.get(iso) ?? null,
    });
  }

  return {
    range,
    points,
    averages: {
      recovery: avg(points.map((p) => p.recovery)),
      hrv: avg(points.map((p) => p.hrv)),
      sleep_hours: avg(points.map((p) => p.sleep_hours)),
      kcal: avg(points.map((p) => p.kcal)),
      protein_g: avg(points.map((p) => p.protein_g)),
      weight_kg: avg(points.map((p) => p.weight_kg)),
    },
  };
}

export const getMyTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => {
    const r = (v as { range?: number })?.range;
    const range: TrendRange = r === 7 || r === 30 || r === 90 ? r : 30;
    return { range };
  })
  .handler(async ({ data, context }) => buildTrends(context.supabase, context.userId, data.range));

export { buildTrends };
