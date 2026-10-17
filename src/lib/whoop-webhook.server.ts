import { WHOOP_API, getAccessToken, localDate, syncWhoopForUser } from "./whoop.server";
import { recoveryFields, sleepFields, removedImportPatch, type WhoopWebhook } from "./whoop-webhook";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function fetchRecord(token: string, path: string) {
  const response = await fetch(`${WHOOP_API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("WHOOP webhook lookup failed");
  return response.json();
}

export async function processWhoopWebhook(event: WhoopWebhook) {
  const db = await admin();
  // Existing connections predate webhook identity tracking. Learn identity from
  // permitted cycle data, never by requesting the optional profile scope.
  let { data: connections, error } = await db.from("whoop_connections").select("user_id").eq("whoop_user_id", String(event.user_id));
  if (error) throw error;
  if (!connections?.length) {
    const { data: unmapped, error: lookupError } = await db.from("whoop_connections").select("user_id").is("whoop_user_id", null).limit(20);
    if (lookupError) throw lookupError;
    for (const row of unmapped ?? []) await syncWhoopForUser(row.user_id, 3);
    const matched = await db.from("whoop_connections").select("user_id").eq("whoop_user_id", String(event.user_id));
    if (matched.error) throw matched.error;
    connections = matched.data;
  }
  // Disconnected users have no connection; acknowledge without importing data.
  for (const row of connections ?? []) await updateForUser(row.user_id, event);
}

async function updateForUser(userId: string, event: WhoopWebhook) {
  if (event.type.startsWith("workout.")) {
    // Cove imports day strain, not workouts; refresh cycles with existing scopes.
    await syncWhoopForUser(userId, 3);
    return;
  }
  const db = await admin();
  const { data: imported, error } = await db.from("whoop_sleep_imports").select("*").eq("user_id", userId).eq("sleep_id", event.id).maybeSingle();
  if (error) throw error;
  const previous = (imported?.values ?? {}) as Record<string, unknown>;
  const remove = async (date: string, fields: readonly string[]) => {
    const { data: current, error: readError } = await db.from("daily_entries").select("*").eq("user_id", userId).eq("entry_date", date).maybeSingle();
    if (readError) throw readError;
    if (!current) return;
    const patch = removedImportPatch(current, previous, fields);
    if (!Object.keys(patch).length) return;
    let query = db.from("daily_entries").update(patch).eq("user_id", userId).eq("entry_date", date).eq("source", "whoop");
    // Compare-and-set also protects edits made after the read.
    for (const field of Object.keys(patch)) query = query.eq(field, previous[field]);
    const { error: writeError } = await query;
    if (writeError) throw writeError;
  };
  if (event.type.endsWith(".deleted")) {
    if (!imported) return; // No ownership history: do not guess which day to clear.
    const fields = event.type === "sleep.deleted" ? [...sleepFields, ...recoveryFields] : recoveryFields;
    await remove(imported.entry_date, fields);
    const values = { ...previous };
    for (const field of fields) delete values[field];
    const result = event.type === "sleep.deleted"
      ? await db.from("whoop_sleep_imports").delete().eq("user_id", userId).eq("sleep_id", event.id)
      : await db.from("whoop_sleep_imports").update({ values: values as never }).eq("user_id", userId).eq("sleep_id", event.id);
    if (result.error) throw result.error;
    return;
  }
  const token = await getAccessToken(userId);
  if (!token) return;
  const sleep = await fetchRecord(token, `/v2/activity/sleep/${event.id}`);
  if (!sleep) return; // A stale update after deletion must not recreate data.
  if (String(sleep.user_id) !== String(event.user_id)) throw new Error("WHOOP account mismatch");
  if (!sleep.end || sleep.nap || sleep.score_state !== "SCORED") return;
  const date = localDate(sleep.end, sleep.timezone_offset);
  if (imported && imported.entry_date !== date) await remove(imported.entry_date, [...sleepFields, ...recoveryFields]);
  const recovery = await fetchRecord(token, `/v2/cycle/${sleep.cycle_id}/recovery`);
  const values: Record<string, number> = {};
  if (sleep.score?.sleep_performance_percentage != null) values.sleep_score = Math.round(sleep.score.sleep_performance_percentage);
  const stage = sleep.score?.stage_summary;
  if (stage?.total_in_bed_time_milli != null) values.sleep_hours = Math.round((stage.total_in_bed_time_milli - (stage.total_awake_time_milli ?? 0)) / 360000) / 10;
  if (recovery?.score_state === "SCORED" && String(recovery.sleep_id) === event.id && String(recovery.user_id) === String(event.user_id)) {
    if (recovery.score?.recovery_score != null) values.recovery = Math.round(recovery.score.recovery_score);
    if (recovery.score?.hrv_rmssd_milli != null) values.hrv = Math.round(recovery.score.hrv_rmssd_milli * 10) / 10;
    if (recovery.score?.resting_heart_rate != null) values.rhr = recovery.score.resting_heart_rate;
  }
  const { data: current, error: readError } = await db.from("daily_entries").select("source").eq("user_id", userId).eq("entry_date", date).maybeSingle();
  if (readError) throw readError;
  const result = current
    ? await db.from("daily_entries").update(values).eq("user_id", userId).eq("entry_date", date).eq("source", "whoop")
    : await db.from("daily_entries").upsert({ user_id: userId, entry_date: date, source: "whoop", ...values }, { onConflict: "user_id,entry_date", ignoreDuplicates: true });
  if (result.error) throw result.error;
  const tracked = await db.from("whoop_sleep_imports").upsert({ user_id: userId, sleep_id: event.id, entry_date: date, values });
  if (tracked.error) throw tracked.error;
  const status = await db.from("whoop_connections").update({ last_synced_at: new Date().toISOString() }).eq("user_id", userId);
  if (status.error) throw status.error;
}

export async function receiveWhoopWebhook(event: WhoopWebhook) {
  const db = await admin();
  const inserted = await db.from("whoop_webhook_events").upsert({ trace_id: event.trace_id, whoop_user_id: String(event.user_id), resource_id: event.id, event_type: event.type }, { onConflict: "trace_id", ignoreDuplicates: true });
  if (inserted.error) throw inserted.error;
  const { data: existing, error } = await db.from("whoop_webhook_events").select("*").eq("trace_id", event.trace_id).single();
  if (error) throw error;
  if (existing.processed_at) return;
  if (existing.whoop_user_id !== String(event.user_id) || existing.resource_id !== event.id || existing.event_type !== event.type) throw new Error("WHOOP event identity mismatch");
  await processWhoopWebhook(event);
  const done = await db.from("whoop_webhook_events").update({ processed_at: new Date().toISOString() }).eq("trace_id", event.trace_id);
  if (done.error) throw done.error;
}

export async function retryWhoopWebhooks() {
  const db = await admin();
  const { data, error } = await db.from("whoop_webhook_events").select("*").is("processed_at", null).order("created_at").limit(25);
  if (error) throw error;
  for (const row of data ?? []) {
    try {
      await receiveWhoopWebhook({ user_id: Number(row.whoop_user_id), id: row.resource_id, type: row.event_type as WhoopWebhook["type"], trace_id: row.trace_id });
    } catch { console.error("WHOOP webhook retry failed"); }
  }
  await db.from("whoop_webhook_events").delete().lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).not("processed_at", "is", null);
}