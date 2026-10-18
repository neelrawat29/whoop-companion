import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { onboardingProfileSchema } from "@/lib/onboarding.shared";
import { computeTargets, computeWaterTarget } from "@/lib/targets.shared";

// iPhone setup flow. Same validation and formulas as the web /onboarding page.
const bodySchema = onboardingProfileSchema.extend({ action: z.enum(["preview", "save", "complete"]) });

export const Route = createFileRoute("/api/public/ios/onboarding")({
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

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
        }
        const { action, ...profile } = parsed.data;
        const t = computeTargets(profile);
        if (!t) return Response.json({ error: "Invalid details" }, { status: 400 });
        const water = computeWaterTarget({ weight_kg: profile.weight_kg, sex: profile.sex });

        if (action !== "preview") {
          const patch: Record<string, unknown> = { ...profile };
          if (action === "complete") {
            Object.assign(patch, {
              kcal_target: t.kcal,
              kcal_burn_target: t.burn_kcal,
              protein_target: t.protein_g,
              carbs_target: t.carbs_g,
              fat_target: t.fat_g,
              sleep_target_hours: t.sleep_hours,
              onboarding_completed: true,
            });
          }
          const { error: upErr } = await supabase.from("profiles").update(patch as never).eq("id", userData.user.id);
          if (upErr) return Response.json({ error: "Couldn't save" }, { status: 500 });
        }
        return Response.json({
          kcal: t.kcal,
          protein_g: t.protein_g,
          carbs_g: t.carbs_g,
          fat_g: t.fat_g,
          water_ml: water.baselineMl,
        });
      },
    },
  },
});
