## What we're building

Three new features, plus a small Settings cleanup. No perf work this round.

### 1. Supplements tab + inline chips on Today

- Add a new `/supplements` route to the top nav.
- Page shows: today's logged supplements at top, a "+ Log supplement" button (pick from saved list or add new on the fly), and a 14-day history list.
- Today's evening card keeps the existing chips for quick logging — both write to the same `habits_log.supplements` field, so they stay in sync.
- Remove the "Manage supplements" section from Settings (Settings keeps only thresholds + display name + sign out).

### 2. Work location on Today

- New field on the evening card: a 3-button toggle — Home / Office / Off (rest day / weekend).
- Stored on `habits_log` as a new `work_location` text column.
- Insights page gets a new correlation card: avg recovery on Home vs Office days (shown once each side has ≥3 samples).

### 3. Meal tracking with AI calorie estimate + manual override

- New `/meals` route on the top nav.
- Per day, minimum four meal slots: Breakfast, Lunch, Dinner, Snacks. Each has:
  - A "+" button to log multiple snacks (this is applicable only for Snacks)
  - A free-text "what you ate" field (e.g., "2 eggs, sourdough toast, black coffee").
  - An "Estimate" button → calls a `createServerFn` that uses **Lovable AI (`google/gemini-3-flash-preview`)** to return `{ kcal, protein_g, carbs_g, fat_g, confidence }` as structured JSON.
  - All four values are editable after the estimate lands (this is the manual override).
  - Save button persists the row.
- Day total at the top: kcal + macros summed across the 4 meals.
- Today page gets a compact "Today's intake" summary card linking to `/meals`.

### Out of scope

- Meal photo recognition, barcode scanning, food database search — can add later.
- Per-supplement timing (e.g., 8am magnesium) — current chips model is good enough for v1.
- Perf optimizations (you said ship features first).

---

## Technical details

**DB migration**

- `ALTER TABLE habits_log ADD COLUMN work_location text` (nullable; values: `home`, `office`, `off`).
- New table `meals(id, user_id, entry_date, slot, description, kcal, protein_g, carbs_g, fat_g, source ['ai'|'manual'], created_at, updated_at)` with UNIQUE `(user_id, entry_date, slot)`.
- RLS scoped to `auth.uid()`, GRANTs for `authenticated` + `service_role`.

**AI server function**

- `src/lib/meals.functions.ts` → `estimateMeal({ description })` using `createServerFn` + `@ai-sdk/openai-compatible` against Lovable AI Gateway (`LOVABLE_API_KEY` already present).
- Model: `google/gemini-3-flash-preview` with `Output.object(zod schema)` for structured nutrition JSON.
- Handles 429 / 402 with a clear toast in the UI.

**Routes**

- New: `src/routes/_authenticated/supplements.tsx`, `src/routes/_authenticated/meals.tsx`.
- Update `src/components/AppShell.tsx` nav to include them (nav becomes 7 items on desktop, collapses sensibly on mobile — we'll move less-used items like Import/Settings behind a "More" menu on mobile to keep the bottom bar usable).
- Update `src/routes/_authenticated/settings.tsx` to drop the supplements block.
- Update `src/routes/_authenticated/index.tsx` evening card to add the work-location toggle and a compact "Today's intake" summary.
- Update `src/routes/_authenticated/insights.tsx` to add the work-location correlation card.

---

## On your perf question (no code change here)

Preview vs Published does make a difference — published runs from Lovable's edge CDN, preview goes through a dev tunnel that's noticeably slower on cold loads. But it's not the whole story. The bigger factors right now are:

- Each route fires several separate Supabase queries on mount with no prefetching.
- `_authenticated` runs `ssr: false` (intentional — Supabase sessions live in `localStorage` and the server can't read them), so there's always a brief client-render flash.

Publishing will help. A focused perf pass (prefetch on hover, consolidate Today's queries into one) would help more — happy to do that as a follow-up whenever you want.