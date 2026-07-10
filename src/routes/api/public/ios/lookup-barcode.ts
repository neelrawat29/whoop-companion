// Public API endpoint the iOS-native app calls to look up a barcode via
// Open Food Facts. Auth is enforced in-handler.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { lookupBarcode } from "@/lib/openfoodfacts.shared";

export const Route = createFileRoute("/api/public/ios/lookup-barcode")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend not configured", { status: 500 });
        }
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        let body: { barcode?: string };
        try { body = (await request.json()) as { barcode?: string }; }
        catch { return new Response("Invalid JSON body", { status: 400 }); }

        try {
          const result = await lookupBarcode(body.barcode ?? "");
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Lookup failed";
          return new Response(msg, { status: 400 });
        }
      },
    },
  },
});
