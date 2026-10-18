// Server-only WHOOP helpers. Tokens live in whoop_connections (service-role only).
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API = "https://api.prod.whoop.com/developer";
export const WHOOP_SCOPES = "offline read:recovery read:cycles read:sleep";

export const ALLOWED_REDIRECTS = [
  "https://cove-companion.lovable.app/api/public/whoop/callback",
  "https://id-preview--603412a2-6b56-45ee-9ba4-200bab1c07f1.lovable.app/api/public/whoop/callback",
];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeToken(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env["WHOOP_CLIENT_ID"] ?? "",
    client_secret: process.env["WHOOP_CLIENT_SECRET"] ?? "",
    ...params,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("WHOOP token error", res.status, await res.text());
    throw new Error("WHOOP token exchange failed");
  }
  return res.json();
}

export async function saveTokens(userId: string, t: TokenResponse, whoopUserId?: string) {
  const db = await admin();
  const row: Record<string, unknown> = {
    user_id: userId,
    access_token: t.access_token,
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    scope: t.scope ?? null,
    updated_at: new Date().toISOString(),
  };
  if (t.refresh_token) row.refresh_token = t.refresh_token;
  if (whoopUserId) row.whoop_user_id = whoopUserId;
  const { error } = await db.from("whoop_connections").upsert(row as never);
  if (error) throw error;
}

export async function getAccessToken(userId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("whoop_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() > Date.now()) return data.access_token;
  if (!data.refresh_token) return null;
  const t = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
    scope: "offline",
  });
  await saveTokens(userId, t);
  return t.access_token;
}

async function whoopGet(token: string, path: string, start: string) {
  const records: any[] = [];
  let next: string | undefined;
  for (let i = 0; i < 4; i++) {
    const u = new URL(`${WHOOP_API}${path}`);
    u.searchParams.set("start", start);
    u.searchParams.set("limit", "25");
    if (next) u.searchParams.set("nextToken", next);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
    console.error("WHOOP api error", path, res.status);
      throw new Error("WHOOP request failed");
    }
    const j = await res.json();
    records.push(...(j.records ?? []));
    next = j.next_token ?? undefined;
    if (!next) break;
  }
  return records;
}

/** Local calendar date of an ISO timestamp given WHOOP's "+08:00" offset. */
export function localDate(iso: string, offset?: string): string {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? "");
  const mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString().slice(0, 10);
}

/** Local wall-clock time "HH:MM" of an ISO timestamp given WHOOP's offset. */
export function localTime(iso: string, offset?: string): string {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? "");
  const mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString().slice(11, 16);
}

export async function syncWhoopForUser(userId: string, days = 14) {
  const token = await getAccessToken(userId);
  if (!token) throw new Error("WHOOP is not connected");
  const start = new Date(Date.now() - days * 86400000).toISOString();

  const [sleeps, recoveries, cycles] = await Promise.all([
    whoopGet(token, "/v2/activity/sleep", start),
    whoopGet(token, "/v2/recovery", start),
    whoopGet(token, "/v2/cycle", start),
  ]);

  const entries = new Map<string, Record<string, unknown>>();
  const sleepDate = new Map<string, string>();
  const get = (d: string) => {
    const existing = entries.get(d);
    if (existing) return existing;
    const entry: Record<string, unknown> = { user_id: userId, entry_date: d, source: "whoop" };
    entries.set(d, entry);
    return entry;
  };

  const sleepTimes = new Map<string, { bedtime: string | null; wake_time: string | null }>();
  for (const s of sleeps) {
    if (s.nap || s.score_state !== "SCORED" || !s.end) continue;
    const d = localDate(s.end, s.timezone_offset);
    sleepDate.set(String(s.id), d);
    sleepTimes.set(d, {
      bedtime: s.start ? localTime(s.start, s.timezone_offset) : null,
      wake_time: localTime(s.end, s.timezone_offset),
    });
    const e = get(d);
    const st = s.score?.stage_summary;
    if (s.score?.sleep_performance_percentage != null)
      e.sleep_score = Math.round(s.score.sleep_performance_percentage);
    if (st?.total_in_bed_time_milli != null) {
      const ms = st.total_in_bed_time_milli - (st.total_awake_time_milli ?? 0);
      e.sleep_hours = Math.round((ms / 3600000) * 10) / 10;
    }
  }

  for (const r of recoveries) {
    if (r.score_state !== "SCORED" || !r.score) continue;
    const d = sleepDate.get(String(r.sleep_id)) ?? (r.created_at ? r.created_at.slice(0, 10) : null);
    if (!d) continue;
    const e = get(d);
    if (r.score.recovery_score != null) e.recovery = Math.round(r.score.recovery_score);
    if (r.score.hrv_rmssd_milli != null) e.hrv = Math.round(r.score.hrv_rmssd_milli * 10) / 10;
    if (r.score.resting_heart_rate != null) e.rhr = r.score.resting_heart_rate;
  }

  const strains: { user_id: string; entry_date: string; strain: number; kcal_burned: number | null }[] = [];
  for (const c of cycles) {
    if (c.score_state !== "SCORED" || c.score?.strain == null || !c.start) continue;
    strains.push({
      user_id: userId,
      entry_date: localDate(c.start, c.timezone_offset),
      strain: Math.round(c.score.strain * 10) / 10,
      // WHOOP reports energy in kilojoules; 1 kcal = 4.184 kJ.
      kcal_burned: c.score.kilojoule != null ? Math.round(c.score.kilojoule / 4.184) : null,
    });
  }

  const db = await admin();
  const identity = cycles[0]?.user_id ?? sleeps[0]?.user_id ?? recoveries[0]?.user_id;
  if (identity != null) {
    const { error } = await db.from("whoop_connections").update({ whoop_user_id: String(identity) }).eq("user_id", userId);
    if (error) throw error;
  }
  const rows = [...entries.values()];
  for (const row of rows) {
    const date = String(row.entry_date);
    const { data: existing, error: readError } = await db.from("daily_entries").select("source").eq("user_id", userId).eq("entry_date", date).maybeSingle();
    if (readError) throw readError;
    const result = existing
      ? await db.from("daily_entries").update(row as never).eq("user_id", userId).eq("entry_date", date).eq("source", "whoop")
      : await db.from("daily_entries").upsert(row as never, { onConflict: "user_id,entry_date", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  // Keep resource ownership so a later delete or changed sleep date can clear
  // just imported fields, not manually edited daily entries.
  for (const sleep of sleeps) {
    const date = sleepDate.get(String(sleep.id));
    if (!date) continue;
    const row = entries.get(date);
    if (!row) continue;
    const values: Record<string, unknown> = {};
    for (const key of ["recovery", "hrv", "rhr", "sleep_score", "sleep_hours"]) {
      if (row[key] != null) values[key] = row[key];
    }
    const { error } = await db.from("whoop_sleep_imports").upsert({ user_id: userId, sleep_id: String(sleep.id), entry_date: date, values: values as never });
    if (error) throw error;
  }
  // Merge strain and sleep times per date; bedtime/wake_time only fill empty
  // fields so manual edits are never overwritten.
  const habitDates = new Set<string>([
    ...strains.map((s) => s.entry_date),
    ...sleepTimes.keys(),
  ]);
  for (const date of habitDates) {
    const strain = strains.find((s) => s.entry_date === date);
    const times = sleepTimes.get(date);
    const { data: existing, error: readError } = await db.from("habits_log").select("id, bedtime, wake_time").eq("user_id", userId).eq("entry_date", date).maybeSingle();
    if (readError) throw readError;
    const patch: Record<string, unknown> = {};
    if (strain) patch.strain = strain.strain;
    if (times?.bedtime && !existing?.bedtime) patch.bedtime = times.bedtime;
    if (times?.wake_time && !existing?.wake_time) patch.wake_time = times.wake_time;
    if (Object.keys(patch).length === 0) continue;
    const result = existing
      ? await db.from("habits_log").update(patch as never).eq("id", existing.id)
      : await db.from("habits_log").upsert({ user_id: userId, entry_date: date, ...patch } as never, { onConflict: "user_id,entry_date", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  await db
    .from("whoop_connections")
    .update({ last_synced_at: new Date().toISOString() } as never)
    .eq("user_id", userId);
  return { days: rows.length, strainDays: strains.length };
}

export async function createAuthorizeUrl(userId: string, redirectUri: string, returnTo: string) {
  const state = crypto.randomUUID().replace(/-/g, "");
  const db = await admin();
  const { error } = await db
    .from("whoop_oauth_states")
    .insert({ state, user_id: userId, redirect_uri: redirectUri, return_to: returnTo });
  if (error) throw new Error("Could not start WHOOP connection");
  const u = new URL(WHOOP_AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env["WHOOP_CLIENT_ID"] ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", WHOOP_SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function getWhoopStatusFor(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("whoop_connections")
    .select("last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  return { connected: !!data, lastSyncedAt: data?.last_synced_at ?? null };
}

export async function disconnectWhoopFor(userId: string) {
  const db = await admin();
  await db.from("whoop_connections").delete().eq("user_id", userId);
}

/** Verifies an iPhone app bearer token; returns the user id or null. */
export async function userIdFromBearer(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = await admin();
  const { data, error } = await db.auth.getUser(auth.slice(7).trim());
  return error || !data.user ? null : data.user.id;
}

/** Hourly job: sync the last 3 days for every connected user. */
export async function syncAllWhoopUsers() {
  const db = await admin();
  const { data } = await db.from("whoop_connections").select("user_id");
  let ok = 0, failed = 0;
  for (const row of data ?? []) {
    try {
      await syncWhoopForUser(row.user_id, 3);
      ok++;
    } catch (e) {
      failed++;
      console.error("WHOOP auto-sync failed for a user", e);
    }
  }
  return { ok, failed };
}
