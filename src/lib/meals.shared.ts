// Shared meal-estimate logic used by both the web server function
// (src/lib/meals.functions.ts) and the iOS-facing API route
// (src/routes/api/public/ios/estimate-meal.ts).
//
// Keep prompt + wire format in one place so web and iOS stay identical.

export type MealEstimateInput = {
  description: string;
  portionNotes?: string;
  userKcalHint?: number | null;
};

export type MealEstimateResult = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: number | null;
  assumptions: string;
};

export const MEAL_SYSTEM_PROMPT = `You are a nutrition estimation engine. Estimate macros for a described meal as accurately as possible.

METHOD (follow strictly):
1. Itemize each food component in the meal.
2. For each component, estimate its cooked/as-eaten weight in grams. If the user didn't specify quantity, use these defaults:
   - 1 egg (large) ≈ 50g
   - 1 slice bread ≈ 35g
   - 1 cup cooked rice/pasta ≈ 160g
   - 1 cup cooked oats ≈ 230g
   - 1 medium banana ≈ 120g, apple ≈ 180g, orange ≈ 130g
   - 1 chicken breast (cooked) ≈ 170g
   - 1 salmon fillet ≈ 150g
   - 1 tbsp oil/butter ≈ 14g, 1 tsp ≈ 5g
   - 1 tbsp peanut/nut butter ≈ 16g
   - 1 "handful" nuts ≈ 30g
   - 1 cup milk ≈ 240g, 1 cup yogurt ≈ 245g
   - 1 slice cheese ≈ 22g, 1 oz ≈ 28g
   - 1 "bowl" pasta/rice (no other context) ≈ 250g cooked
   - 1 "plate" main meal (no other context) ≈ 450g total
3. For each component, derive kcal, protein, carbs, fat from typical USDA per-100g values, then scale by the gram estimate.
4. Sum all components.
5. SANITY CHECK: kcal must be consistent with (protein_g * 4 + carbs_g * 4 + fat_g * 9) within ±10%. If not, recompute — usually fat or portion size is off.
6. If the user provided a kcal hint (their own estimate), recalibrate portion sizes so your total is within ~10% of their hint, keeping the macro ratios sensible for the foods described.

OUTPUT:
- kcal: integer
- protein_g, carbs_g, fat_g: one decimal place
- confidence: 0–1, lower it when portions are vague
- assumptions: ONE short sentence listing the key portion assumptions you made (e.g. "Assumed 2 large eggs (100g), 1 slice sourdough (35g), 1 tsp butter (5g).")

Do NOT include any commentary outside the JSON.`;

export function validateMealEstimateInput(data: MealEstimateInput) {
  if (!data?.description || typeof data.description !== "string") {
    throw new Error("description required");
  }
  if (data.description.length > 4000) throw new Error("Description too long");
  if (data.portionNotes && data.portionNotes.length > 1000) {
    throw new Error("Portion notes too long");
  }
  const hint =
    data.userKcalHint == null || Number.isNaN(Number(data.userKcalHint))
      ? null
      : Math.max(0, Math.min(10000, Number(data.userKcalHint)));
  return {
    description: data.description,
    portionNotes: data.portionNotes?.trim() || "",
    userKcalHint: hint,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export async function runMealEstimate(
  input: ReturnType<typeof validateMealEstimateInput>,
  apiKey: string,
): Promise<MealEstimateResult> {
  const userParts = [`Meal: ${input.description}`];
  if (input.portionNotes) userParts.push(`Portion notes: ${input.portionNotes}`);
  if (input.userKcalHint != null) {
    userParts.push(
      `User's own kcal estimate (calibrate to within ~10%): ${input.userKcalHint} kcal`,
    );
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: MEAL_SYSTEM_PROMPT },
        { role: "user", content: userParts.join("\n") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meal_estimate",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              kcal: { type: "integer" },
              protein_g: { type: "number" },
              carbs_g: { type: "number" },
              fat_g: { type: "number" },
              confidence: { type: "number" },
              assumptions: { type: "string" },
            },
            required: ["kcal", "protein_g", "carbs_g", "fat_g", "confidence", "assumptions"],
          },
        },
      },
    }),
  });

  if (res.status === 429) throw new Error("Rate limit hit — try again in a minute");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
  if (!res.ok) throw new Error(`AI error ${res.status}`);

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const p = JSON.parse(cleaned);
    return {
      kcal: numOrNull(p.kcal),
      protein_g: numOrNull(p.protein_g),
      carbs_g: numOrNull(p.carbs_g),
      fat_g: numOrNull(p.fat_g),
      confidence: numOrNull(p.confidence),
      assumptions: typeof p.assumptions === "string" ? p.assumptions : "",
    };
  } catch {
    throw new Error("Could not parse AI response");
  }
}
