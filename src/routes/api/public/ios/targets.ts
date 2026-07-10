import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeTargets, DEFAULT_SLEEP_HOURS, type ActivityLevel, type Goal, type Sex } from "@/lib/targets.shared";

async function loadProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("sex,height_cm,weight_kg,date_of_birth,activity_level,goal,kcal_target,protein_target,carbs_target,fat_target,sleep_target_hours,birth_year")
    .eq("id", userId)
    .maybeSingle();
  const p = (data ?? {}) as Record<string, unknown>;
  const birth_year =
    (p.birth_year as number | null) ??
    (p.date_of_birth ? new Date(p.date_of_birth as string).getFullYear() : null);
  const computed = computeTargets({
    sex: p.sex as Sex,
    height_cm: (p.height_cm as number | null) ?? null,
    weight_kg: (p.weight_kg as number | null) ?? null,
    birth_year,
    activity_level: p.activity_level as ActivityLevel,
    goal: p.goal as Goal,
  });
  return {
    sex: (p.sex as Sex) ?? null,
    height_cm: (p.height_cm as number | null) ?? null,
    weight_kg: (p.weight_kg as number | null) ?? null,
    birth_year,
    activity_level: (p.activity_level as ActivityLevel) ?? null,
    goal: (p.goal as Goal) ?? null,
    kcal_target: (p.kcal_target as number | null) ?? computed?.kcal ?? null,
    protein_target: (p.protein_target as number | null) ?? computed?.protein_g ?? null,
    carbs_target: (p.carbs_target as number | null) ?? computed?.carbs_g ?? null,
    fat_target: (p.fat_target as number | null) ?? computed?.fat_g ?? null,
    sleep_target_hours: (p.sleep_target_hours as number | null) ?? DEFAULT_SLEEP_HOURS,
    computed,
  };
}

export const Route = createFileRoute("/api/public/ios/targets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return new Response("Not configured", { status: 500 });
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7).trim();
        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error } = await supabase.auth.getUser(token);
        if (error || !userData.user) return new Response("Unauthorized", { status: 401 });
        const payload = await loadProfile(supabase, userData.user.id);
        return Response.json(payload);
      },
    },
  },
});
