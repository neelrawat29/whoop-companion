import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function eraseUserData(supabase: any, userId: string) {
  // Delete chat messages first (in case cascade is missing), then threads.
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

  // Reset profile baseline + targets, keep row + display_name.
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
    } as any)
    .eq("id", userId);
}

export const eraseMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await eraseUserData(context.supabase, context.userId);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await eraseUserData(context.supabase, context.userId);
    await context.supabase.from("group_members").delete().eq("user_id", context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
