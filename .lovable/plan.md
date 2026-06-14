# Biological Age feature

## Concept

A single number — your "Biological Age" — calculated daily from your 30-day rolling logs, compared against your chronological age. Inspired by Whoop Age but transparent: every modifier is shown so you understand *why* your body is reading older or younger.

## 1. Profile inputs (new)

Extend the `profiles` table with the anchors needed for accurate norms:

- `date_of_birth` (date)
- `sex` (enum: `male` / `female` / `other`) — `other` falls back to a sex-averaged norm
- `height_cm` (numeric)
- `weight_kg` (numeric)
- `resting_hr_baseline` (int, optional) — auto-derived from your last 30 days of `daily_entries.rhr` if logged, otherwise user-entered

Add a "Body & baseline" section to **Settings** so users can fill these in. Show a friendly banner on the Biological Age page until DOB + sex are set ("Add your date of birth to unlock Biological Age").

## 2. The algorithm

Biological Age = Chronological Age + Σ(modifiers, in years), clamped to chronological age ± 15.

All inputs are aggregated over the **rolling 30-day window** and compared to **age- and sex-adjusted norms**. Each domain contributes a sub-score in years, then we sum.

### Cardiovascular (heaviest weight: up to ±6 yrs)
- **Resting HR vs norm**: every 5 bpm below your age/sex norm = −1 yr; every 5 bpm above = +1 yr.
- **HRV vs norm** (if logged): every 10ms above the age/sex median = −1 yr; every 10ms below = +1 yr.

### Recovery & sleep (up to ±4 yrs)
- **Avg recovery score**: 70+ → −2, 50–69 → 0, <50 → +2.
- **Avg sleep hours**: 7–9h → −1, 6–7 or 9–10 → 0, <6 or >10 → +2.
- **Sleep consistency**: stdev of bedtime <45min → −1, >90min → +1.

### Body composition (up to ±2 yrs)
- **BMI** from height/weight: 18.5–24.9 → −1, 25–29.9 → 0, <18.5 or 30+ → +2.

### Lifestyle & habits (up to ±3 yrs)
- **Avg energy + mood** (habits_log, 1–5 scale): combined avg ≥4 → −1, ≤2 → +1.
- **Hydration**: avg ≥6 glasses → −0.5; <3 → +1.
- **Alcohol**: avg drinks/day ≥2 → +2; ≤0.5 → −0.5.
- **Logging consistency** (days logged in 30d): ≥25 → −0.5; <10 → blocks the score with a "log more to unlock" state.

### Nutrition (up to ±1.5 yrs)
- **Protein**: avg ≥1.2g/kg bodyweight → −0.5.
- **Caloric balance signal**: heavy day-to-day kcal swings (stdev/mean > 0.4) → +0.5.
- **Macro balance**: at least 3 logged meals/day on avg → −0.5.

### Confidence
The page also shows a **confidence %** = how many input domains have enough data. With only recovery+sleep we cap the delta at ±3 years and label it "Estimate — log more for accuracy."

## 3. Where it lives

A new route under Insights: `src/routes/_authenticated/insights.biological-age.tsx`, linked from the Insights page and from the home dashboard via a small "Biological Age: 31 (−3 yr)" card.

### Page layout
1. **Hero number**: big "31" with chronological age and delta ("−3 years younger").
2. **Trend chart**: last 90 days of biological age, line chart.
3. **Contribution breakdown**: each domain (Cardio, Sleep, Recovery, Body, Lifestyle, Nutrition) as a horizontal bar showing its +/- years contribution today.
4. **What's helping / hurting**: two short lists derived from the same modifiers (top 3 positive, top 3 negative).
5. **Confidence & data freshness**: small footer.

## 4. Technical implementation

### Database
- Migration: add the 5 profile columns above. No new table — we compute on the fly from existing logs; daily caching can come later if performance demands it.

### Server functions (`src/lib/biological-age.functions.ts`)
- `getBiologicalAge()`: reads the user's profile + 30 days of `daily_entries`, `habits_log`, `meals`; runs the pure scorer; returns `{ chronological, biological, delta, confidence, modifiers: [{domain, label, years, direction}], inputsUsed, missingInputs }`.
- `getBiologicalAgeHistory()`: computes the score for each of the last 90 days (sliding 30-day window per day) for the trend chart. Cap at 90 to keep the request cheap.

Pure scorer lives in `src/lib/biological-age.ts` (no Supabase imports) so it's unit-testable and reused by both server functions.

### Route
- `src/routes/_authenticated/insights.biological-age.tsx` — uses TanStack Query (`ensureQueryData` + `useSuspenseQuery`) per the project pattern. `errorComponent` + `notFoundComponent` defined.
- Add a sub-nav link from the existing Insights page.
- Add a compact summary card on the dashboard (`_authenticated/index.tsx`) that links here.

### Profile editing
- Extend the existing Settings page with a "Body & baseline" form. Validate with zod (DOB in past, height 100–250, weight 30–300, RHR 30–120).

## Out of scope (now)

- VO2max-based estimates (we don't have a treadmill test).
- Per-day caching table (recompute on demand for the active user; trend is 90 small computations).
- Sharing your biological age in Community groups (privacy model is currently aggregates only; can revisit later).

## Build order
1. Migration: profile columns.
2. Pure scorer + unit-friendly types.
3. Server functions.
4. Settings form additions.
5. Insights → Biological Age page + dashboard card.
6. Smoke test with your existing 30 days of data.
