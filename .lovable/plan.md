## Goal

Make the AI macro estimates on the Meals page meaningfully more accurate, and give the user tools to nudge estimates when they're off.

## Why current estimates are off

`src/lib/meals.functions.ts` calls `google/gemini-2.5-flash` with a one-line system prompt and a single free-text user message. No reasoning, no portion clarification, no examples, no structured output — the model essentially guesses, and Flash (the cheapest tier) is the weakest at numeric reasoning.

## Proposed fixes (combined, biggest lift first)

### 1. Upgrade the model + ask for structured reasoning
- Switch from `google/gemini-2.5-flash` to `google/gemini-2.5-pro` for meal estimation. Pro is dramatically better at numeric/nutrition reasoning. (Flash stays the default elsewhere.)
- Use the AI Gateway's **structured outputs** (`response_format: json_schema`) so the model is forced to return valid JSON matching our schema — no more regex-stripping ```json fences, no parse failures.
- Schema includes a new `assumptions: string` field (e.g. "Assumed 1 medium banana ≈ 120g, 2 tbsp peanut butter ≈ 32g") which we surface under the meal so the user can see *why* the estimate landed where it did.

### 2. Much stronger system prompt
Replace the current one-liner with a prompt that:
- Tells the model to itemize each component, estimate its weight in grams, and sum macros from a per-100g basis (USDA-style mental model).
- Specifies default portions for common ambiguous foods (1 egg = 50g, 1 slice bread = 35g, 1 cup cooked rice = 160g, 1 tbsp oil = 14g, etc.).
- Demands kcal be internally consistent with macros (4/4/9 rule) within ±10%, and to recompute if not.
- Forbids rounding bias — return integers for kcal, one decimal for macros.

### 3. Let the user supply a hint / portion correction
Add an optional "Portion notes" input next to the description (e.g. "large bowl, ~300g pasta", "no oil", "double cheese"). It's appended to the prompt. Cheapest accuracy win — the model can't read the user's mind about portion size, so we let them tell it.

### 4. Show assumptions + a quick re-estimate
- Render the returned `assumptions` line under the macro grid (small muted text).
- Add a "Re-estimate" button distinct from the first estimate, which sends the description + portion notes + the user's *current edited* macros as a "calibration" signal ("user says ~650 kcal, refine breakdown").

### 5. Light input hygiene
- Bump `description` max from 2000 → 4000 chars (combined with portion notes).
- Keep the 429 / 402 error handling.

## Out of scope (mention, don't build)
- Photo-based estimation (would need image upload + multimodal call).
- A local foods database / barcode lookup.
- Per-user learning (storing past corrections to fine-tune future prompts).

Happy to add any of these as a follow-up if you want.

## Files touched

- `src/lib/meals.functions.ts` — model swap, structured outputs schema, new system prompt, accept `portionNotes` + optional `userKcalHint`, return `assumptions`.
- `src/routes/_authenticated/meals.tsx` — new "Portion notes" input, render `assumptions` line, "Re-estimate" button passing current macros as hint.

No DB schema changes. No new dependencies.
