import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { saveRecapPayload, validateRecapPayload } from "@/lib/recap.shared";

export const Route = createFileRoute("/api/public/ios/save-recap")({
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
        let body: unknown = {};
        try { body = await request.json(); } catch { body = {}; }
        try {
          const validated = validateRecapPayload(body);
          const result = await saveRecapPayload(supabase, userData.user.id, validated);
          return Response.json(result);
        } catch (e: any) {
          return new Response(e?.message ?? "Save failed", { status: 400 });
        }
      },
    },
  },
});
