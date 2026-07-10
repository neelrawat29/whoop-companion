import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeSupplementStats, type SupplementStat } from "./supplements.shared";

export const getSupplementStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupplementStat[]> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const [suppsRes, histRes] = await Promise.all([
      supabase
        .from("user_supplements")
        .select("id,name,time_of_day")
        .eq("user_id", userId)
        .order("name"),
      supabase
        .from("habits_log")
        .select("entry_date,supplements")
        .eq("user_id", userId)
        .gte("entry_date", cutoffIso)
        .lte("entry_date", today),
    ]);
    if (suppsRes.error) throw suppsRes.error;
    if (histRes.error) throw histRes.error;

    return computeSupplementStats(
      (suppsRes.data ?? []) as any,
      (histRes.data ?? []) as any,
      today,
    );
  });
