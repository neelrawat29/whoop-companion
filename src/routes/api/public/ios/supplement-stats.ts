import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeSupplementStats } from "@/lib/supplements.shared";

export const Route = createFileRoute("/api/public/ios/supplement-stats")({
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
        const userId = userData.user.id;

        const today = new Date().toISOString().slice(0, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 29);
        const cutoffIso = cutoff.toISOString().slice(0, 10);

        const [suppsRes, histRes] = await Promise.all([
          supabase
            .from("user_supplements")
            .select("id,name,time_of_day")
            .eq("user_id", userId)
            .order("name"),
          supabase
            .from("habits_log")
            .select("entry_date,supplements")
            .eq("user_id", userId)
            .gte("entry_date", cutoffIso)
            .lte("entry_date", today),
        ]);
        if (suppsRes.error) return new Response(suppsRes.error.message, { status: 400 });
        if (histRes.error) return new Response(histRes.error.message, { status: 400 });

        const stats = computeSupplementStats(
          (suppsRes.data ?? []) as any,
          (histRes.data ?? []) as any,
          today,
        );
        return Response.json(stats);
      },
    },
  },
});
