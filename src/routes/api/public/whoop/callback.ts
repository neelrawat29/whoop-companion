import { createFileRoute } from "@tanstack/react-router";
import { whoopCallbackLocation, type WhoopResult } from "@/lib/whoop-return";

function back(target: string, status: WhoopResult) {
  return new Response(null, { status: 302, headers: { Location: whoopCallbackLocation(target, status), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export const Route = createFileRoute("/api/public/whoop/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const fallbackOrigin = "https://cove-companion.lovable.app";
        if (!state || !/^[a-f0-9]{32}$/.test(state)) return back(fallbackOrigin, "error");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("whoop_oauth_states")
          .select("*")
          .eq("state", state)
          .maybeSingle();
        if (!row) return back(fallbackOrigin, "error");
        await supabaseAdmin.from("whoop_oauth_states").delete().eq("state", state);
        const target = row.return_to;

        const fresh = Date.now() - new Date(row.created_at).getTime() < 15 * 60 * 1000;
        if (!code || !fresh) return back(target, url.searchParams.get("error") ? "denied" : "error");

        try {
          const w = await import("@/lib/whoop.server");
          const t = await w.exchangeToken({
            grant_type: "authorization_code",
            code,
            redirect_uri: row.redirect_uri,
          });
          await w.saveTokens(row.user_id, t);
          try {
            await w.syncWhoopForUser(row.user_id);
          } catch (e) {
            console.error("Initial WHOOP sync failed", e);
          }
          return back(target, "connected");
        } catch (e) {
          console.error("WHOOP callback failed", e);
          return back(target, "error");
        }
      },
    },
  },
});
