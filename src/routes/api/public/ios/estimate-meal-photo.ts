// Public API endpoint the iOS-native app calls for meal AI photo estimation.
// Auth is enforced in-handler via Supabase bearer verification.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  runMealEstimateFromPhoto,
  validateMealPhotoInput,
  type MealPhotoInput,
} from "@/lib/meals.shared";

export const Route = createFileRoute("/api/public/ios/estimate-meal-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend not configured", { status: 500 });
        }
        if (!LOVABLE_API_KEY) return new Response("AI not configured", { status: 500 });

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

        let body: MealPhotoInput;
        try { body = (await request.json()) as MealPhotoInput; }
        catch { return new Response("Invalid JSON body", { status: 400 }); }

        let validated: ReturnType<typeof validateMealPhotoInput>;
        try { validated = validateMealPhotoInput(body); }
        catch (err) { return new Response(err instanceof Error ? err.message : "Bad request", { status: 400 }); }

        try {
          const result = await runMealEstimateFromPhoto(validated, LOVABLE_API_KEY);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Estimate failed";
          const status = /rate limit/i.test(msg) ? 429 : /credits/i.test(msg) ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
