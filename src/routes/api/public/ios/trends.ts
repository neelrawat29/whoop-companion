import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildTrends, type TrendRange } from "@/lib/trends.functions";

export const Route = createFileRoute("/api/public/ios/trends")({
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

        const body = (await request.json().catch(() => ({}))) as { range?: number };
        const r = body?.range;
        const range: TrendRange = r === 7 || r === 30 || r === 90 ? r : 30;

        const trends = await buildTrends(supabase, userData.user.id, range);
        return Response.json(trends);
      },
    },
  },
});
