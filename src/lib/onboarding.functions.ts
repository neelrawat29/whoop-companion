import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onboardingProfileSchema } from "./onboarding.shared";
import { computeTargets } from "./targets.shared";

/** Saves setup answers; when `complete`, also stores computed targets and finishes setup. */
export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => onboardingProfileSchema.extend({ complete: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { complete, ...profile } = data;
    const t = computeTargets(profile);
    if (!t) throw new Error("Missing details");
    const patch: Record<string, unknown> = { ...profile };
    if (complete) {
      Object.assign(patch, {
        kcal_target: t.kcal,
        protein_target: t.protein_g,
        carbs_target: t.carbs_g,
        fat_target: t.fat_g,
        sleep_target_hours: t.sleep_hours,
        onboarding_completed: true,
      });
    }
    const { error } = await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
