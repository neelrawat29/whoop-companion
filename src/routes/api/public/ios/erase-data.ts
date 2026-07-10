import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function eraseUserData(supabase: any, userId: string) {
  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId);
  const threadIds = (threads ?? []).map((t: { id: string }) => t.id);
  if (threadIds.length) {
    await supabase.from("chat_messages").delete().in("thread_id", threadIds);
  }
  await Promise.all([
    supabase.from("daily_entries").delete().eq("user_id", userId),
    supabase.from("habits_log").delete().eq("user_id", userId),
    supabase.from("meals").delete().eq("user_id", userId),
    supabase.from("meal_presets").delete().eq("user_id", userId),
    supabase.from("weight_entries").delete().eq("user_id", userId),
    supabase.from("user_supplements").delete().eq("user_id", userId),
    supabase.from("chat_threads").delete().eq("user_id", userId),
    supabase.from("pinned_insights").delete().eq("user_id", userId),
  ]);
  await supabase
    .from("profiles")
    .update({
      date_of_birth: null,
      sex: null,
      height_cm: null,
      weight_kg: null,
      resting_hr_baseline: null,
      activity_level: null,
      goal: null,
      kcal_target: null,
      protein_target: null,
      carbs_target: null,
      fat_target: null,
      sleep_target_hours: null,
      weight_goal_kg: null,
      weight_goal_date: null,
    })
    .eq("id", userId);
}

export const Route = createFileRoute("/api/public/ios/erase-data")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        await eraseUserData(supabase, userData.user.id);
        return Response.json({ ok: true });
      },
    },
  },
});
