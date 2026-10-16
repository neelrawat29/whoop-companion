import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startWhoopConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ALLOWED_REDIRECTS, WHOOP_AUTH_URL, WHOOP_SCOPES } = await import("./whoop.server");
    const redirect = `${data.origin.replace(/\/$/, "")}/api/public/whoop/callback`;
    const redirectUri = ALLOWED_REDIRECTS.includes(redirect) ? redirect : ALLOWED_REDIRECTS[0];
    const state = crypto.randomUUID().replace(/-/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("whoop_oauth_states")
      .insert({ state, user_id: context.userId, redirect_uri: redirectUri });
    if (error) throw new Error("Could not start WHOOP connection");
    const u = new URL(WHOOP_AUTH_URL);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", process.env["WHOOP_CLIENT_ID"]!);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", WHOOP_SCOPES);
    u.searchParams.set("state", state);
    return { url: u.toString() };
  });

export const getWhoopStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("whoop_connections")
      .select("last_synced_at, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, lastSyncedAt: data?.last_synced_at ?? null };
  });

export const syncWhoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncWhoopForUser } = await import("./whoop.server");
    return syncWhoopForUser(context.userId);
  });

export const disconnectWhoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whoop_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });
