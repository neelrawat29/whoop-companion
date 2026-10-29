import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadWeeklySummary } from "@/lib/weekly-summary";

// iPhone Insights: same weekly summary as the web page.
export const Route = createFileRoute("/api/public/ios/weekly-summary")({
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

        // The app sends the device's calendar date so the week ends on their local today.
        const localDate = request.headers.get("x-local-date");
        const today = localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : new Date().toISOString().slice(0, 10);

        try {
          return Response.json(await loadWeeklySummary(supabase, userData.user.id, today));
        } catch {
          return Response.json({ error: "Couldn't load weekly-summary" }, { status: 500 });
        }
      },
    },
  },
});
