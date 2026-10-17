import { createFileRoute } from "@tanstack/react-router";

// Called hourly by the database scheduler. Verifies a shared token stored in a
// service-role-only table before syncing anyone.
export const Route = createFileRoute("/api/public/whoop/cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-token") ?? "";
        if (!/^[a-f0-9]{64}$/.test(provided)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("internal_cron_tokens")
          .select("token")
          .eq("name", "whoop_sync")
          .maybeSingle();
        const expected = data?.token ?? "";
        let diff = provided.length ^ expected.length;
        for (let i = 0; i < provided.length && i < expected.length; i++)
          diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
        if (!expected || diff !== 0) return new Response("Unauthorized", { status: 401 });
        const { syncAllWhoopUsers } = await import("@/lib/whoop.server");
        const { retryWhoopWebhooks } = await import("@/lib/whoop-webhook.server");
        await retryWhoopWebhooks();
        return Response.json(await syncAllWhoopUsers());
      },
    },
  },
});
