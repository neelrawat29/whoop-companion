import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runMealEstimate,
  validateMealEstimateInput,
  type MealEstimateInput,
} from "@/lib/meals.shared";

export const estimateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: MealEstimateInput) => validateMealEstimateInput(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    return runMealEstimate(data, apiKey);
  });
