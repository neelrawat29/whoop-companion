// Public API endpoint the iOS-native app calls to fetch the user's recent
// distinct meal descriptions for one-tap re-log.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/ios/recent-meals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const { data, error } = await (supabase as any)
          .from("meals")
          .select("description, kcal, protein_g, carbs_g, fat_g, created_at")
          .not("description", "is", null)
          .neq("description", "")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return new Response(error.message, { status: 500 });

        const seen = new Set<string>();
        const recents: any[] = [];
        for (const row of data ?? []) {
          const key = String(row.description).trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          recents.push({
            description: row.description,
            kcal: row.kcal,
            protein_g: row.protein_g,
            carbs_g: row.carbs_g,
            fat_g: row.fat_g,
            last_used: row.created_at,
          });
          if (recents.length >= 10) break;
        }
        return new Response(JSON.stringify(recents), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
