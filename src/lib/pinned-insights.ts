// Findings a user has pinned from Insights to Today. Stored in pinned_insights
// (RLS: own rows only). `source` identifies what was pinned, e.g.
// "habit:alcohol", so Insights can show the pin state and keep the saved text
// in step with the latest analysis. The iPhone uses the same rows and format.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { HabitFinding } from "./habit-insights";

export type PinnedInsight = { id: string; content: string; source: string | null; created_at: string };

export const habitPinSource = (findingId: string) => `habit:${findingId}`;

export async function loadPins(supabase: SupabaseClient<Database>): Promise<PinnedInsight[]> {
  const { data, error } = await supabase
    .from("pinned_insights")
    .select("id,content,source,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Pins a habit finding unless it's already pinned. */
export async function pinFinding(supabase: SupabaseClient<Database>, userId: string, f: HabitFinding) {
  const source = habitPinSource(f.id);
  const { data: existing, error: readErr } = await supabase.from("pinned_insights").select("id").eq("source", source).limit(1);
  if (readErr) throw readErr;
  if (existing?.length) return;
  const { error } = await supabase.from("pinned_insights").insert({ user_id: userId, source, content: f.sentence });
  if (error) throw error;
}

export async function unpin(supabase: SupabaseClient<Database>, id: string) {
  const { error } = await supabase.from("pinned_insights").delete().eq("id", id);
  if (error) throw error;
}

/** Pins whose saved text no longer matches the latest analysis of the same finding. */
export function stalePins(pins: PinnedInsight[], findings: HabitFinding[]): { id: string; content: string }[] {
  const bySource = new Map(findings.map((f) => [habitPinSource(f.id), f.sentence]));
  return pins.flatMap((p) => {
    const latest = p.source ? bySource.get(p.source) : undefined;
    return latest && latest !== p.content ? [{ id: p.id, content: latest }] : [];
  });
}

export async function refreshPins(supabase: SupabaseClient<Database>, updates: { id: string; content: string }[]) {
  for (const u of updates) {
    const { error } = await supabase.from("pinned_insights").update({ content: u.content }).eq("id", u.id);
    if (error) throw error;
  }
}
