# Implementation Plan — P0 / P1 / P2 UX Upgrades

Scope is large (10 features × 2 platforms). To keep things safe and testable, I'll ship in **4 phased batches**, each independently buildable, deployable, and reversible. Nothing existing is removed — every change is additive or behind a new UI affordance.

---

## Guiding rules for every batch

- **No breaking changes.** New DB columns are nullable with defaults; new tables are additive. Existing server functions and API routes stay as-is.
- **Web ↔ iOS parity via shared server logic.** Every AI call gets both a `createServerFn` (web) and an `/api/public/ios/*` route (iOS) that reuses the same helper in `src/lib/*.shared.ts`.
- **Verification per batch** before moving on: `bun run build`, `tsgo`, manual smoke on `/meals`, `/weight`, `/insights`, `/chat`, `/supplements`, `/log`; iOS `xcodegen generate` + build with `SmokeTests.swift`.
- **Cost control.** Vision + estimation calls use `google/gemini-2.5-flash` by default (cheap, multimodal); heavy reasoning (chat, correlations) uses `google/gemini-2.5-pro`.

---

## Batch 1 — Meals overhaul (P0 #1, #2, #3)

**Goal:** users log meals in <5 s via photo, barcode, or one-tap preset.

### Data model
Migration adds:
- `meals.image_url text null`, `meals.barcode text null`, `meals.source` already exists — extend allowed values: `manual | ai | photo | barcode | preset`.
- New table `meal_presets(id uuid pk, user_id uuid, name text, description text, kcal, protein_g, carbs_g, fat_g, created_at)` + RLS + grants.
- New Storage bucket `meal-photos` (private, RLS: owner-only read/write).

### Shared server logic (`src/lib/`)
- `meals.shared.ts` → add `runMealEstimateFromImage(imageUrl, apiKey)` using `google/gemini-2.5-flash` vision, same JSON schema output.
- `meals.presets.shared.ts` → CRUD helpers.
- `openfoodfacts.shared.ts` → `lookupBarcode(code)` → `{ name, kcal, protein_g, carbs_g, fat_g }` via `https://world.openfoodfacts.org/api/v2/product/<code>.json` (no key required).

### Web
- Server fns: `estimateMealFromPhoto`, `lookupBarcode`, `listPresets`, `savePreset`, `deletePreset`.
- `/meals` UI: add three buttons per slot — **Photo**, **Barcode** (uses `BarcodeDetector` where available), **Preset** (dropdown of user's presets + "Save current as preset").
- "Recent meals" section shows last 10 distinct meals from `meals` table with one-tap "Log again".

### iOS
- New public routes: `/api/public/ios/estimate-meal-photo`, `/api/public/ios/lookup-barcode`, `/api/public/ios/presets` (GET/POST/DELETE).
- `MealsView`: camera + photo-library picker → uploads to `meal-photos` bucket (signed URL) → calls photo estimate.
- Barcode scanner via `AVCaptureMetadataOutput` (EAN-13/UPC-A) → `lookupBarcode` → prefill.
- Presets: bottom sheet, "Save as preset" button on each saved meal, "Recent" list at top.

### Test
Manual: log a meal from each source path (typed, photo, barcode, preset, recent) on web + iOS; verify DB rows have correct `source`. Add `SmokeTests.swift` case that opens Meals and asserts new buttons render.

---

## Batch 2 — Global UX polish (P0 #5)

Small, low-risk polish across both platforms.

### iOS
- `KeyboardToolbar` extended: add **Prev / Next / Done** buttons that walk `@FocusState` across fields in Log, Meals, Weight, Supplements.
- Haptics helper `Haptics.success() / .warning() / .error()` fired on save/delete/estimate.
- `.presentationDragIndicator(.visible)` on every sheet.
- `.refreshable { await vm.load() }` on Home, Meals, Log, Weight, Insights.

### Web
- `AppShell` gets a `⌘K` command palette (Radix `Dialog` + fuzzy list of routes + "New meal / New weight / Ask AI").
- Keyboard shortcuts hook (`useHotkeys`) — `n` new entry on current tab, `g m|w|i|c|s` jump-nav.
- Toast on destructive actions with 5 s **Undo** (re-inserts deleted row).

### Test
Web build + click through nav; iOS smoke test taps a field, presses Next, verifies focus moves.

---

## Batch 3 — Targets, rings, trends, smarter chat (P1 #6, #7, #8)

### Data model
Migration adds to `profiles`:
- `sex text`, `height_cm numeric`, `birth_year int`, `activity_level text`, `goal text`, `kcal_target int`, `protein_target int`, `carbs_target int`, `fat_target int`, `sleep_target_hours numeric` — all nullable.
- `compute_daily_targets(profile row)` SQL helper (Mifflin-St Jeor × activity multiplier), stored client-side too for live preview.

### Targets & rings (P1 #6)
- Onboarding step added to `/auth` post-signup → collects sex/height/weight/goal → calls `computeAndSaveTargets` server fn.
- `Home` (web) + `HomeView` (iOS): three SwiftUI/`recharts` rings — kcal, protein, sleep — with remaining count.
- Meals header shows "X kcal / Y protein left today".

### Trends (P1 #7)
- New route `/insights/trends` + `TrendsView.swift`. Server fn `getTrends({ range: 7|30|90 })` returns arrays for weight, recovery, HRV, sleep_hours, avg protein, avg kcal.
- Chart component: sparkline + 7-day rolling avg overlay (`recharts` web, Swift Charts iOS).
- "Correlations" card: server fn `getCorrelations` computes Pearson r between (protein_g, recovery), (sleep_hours, recovery), (kcal_deficit, weight_delta) over 30 d — surfaces top 3 with plain-English sentence generated by `gemini-2.5-flash`.

### Smarter chat (P1 #8)
- Modify `/api/chat` and `/api/public/ios/chat` (new) to auto-inject a "today's context" system message: recovery, sleep, meals-so-far, weight trend, active supplements. Pulled server-side via `requireSupabaseAuth`'s supabase client.
- Empty-state suggested prompts (3–5 rotating chips) on chat view.
- "Pin as insight" button on any assistant message → writes to new `pinned_insights` table → surfaces on Home.

### Test
- Seed test user, verify rings render with correct math (kcal target = TDEE ± goal delta).
- Snapshot chart with 30 d fake data.
- Chat: send "why is my recovery low today?" → verify system context includes actual today's values (log assistant prompt server-side in dev).

---

## Batch 4 — Supplements intelligence + Weight/Insights depth (P1 #10, P2 #12, #14)

### Supplements (P1 #10)
- `user_supplements` gains `reminder_times text[]` (HH:MM strings), `dose text`, `notes text`.
- Web: reminder times editor per supplement; browser `Notification` API + service-worker scheduled push.
- iOS: `UNUserNotificationCenter` local notifications scheduled on save/edit.
- Server fn `checkSupplementInteractions(list)` → one AI call to `gemini-2.5-flash` returning `[{ pair, severity, note }]`; cached in new `supplement_interactions_cache` table keyed by sorted-name hash to avoid re-billing.
- Interactions card in Supplements view.

### Weight tab (P2 #12)
- Server fn `getWeightSeries` already indirectly exists; extend to compute 7-day rolling avg + delta vs 7/30/90 d.
- Chart: daily dots + smoothed line overlay (`recharts` / Swift Charts).
- Optional weekly fields: waist_cm, chest_cm (nullable cols added to `weight_entries`).

### Insights depth (P2 #14)
- Biological-age view: add breakdown table showing input contributions ("HRV pulls age −2.1 y, RHR pushes +0.8 y…") — computed client-side from existing `biological-age.ts` weights, no new AI call.
- 30-day age history line chart (recompute per-day from historical `daily_entries`).
- New "Sleep debt" card: rolling sum of (sleep_target − actual) over 7 d.
- New "Best day this week" card: picks max recovery day, shows what was different.

### Test
- Supplement reminder: schedule for +1 min, verify fires on web + iOS.
- Interactions cache: second call for same set returns from DB without hitting AI (log gate).
- Weight chart: seed 30 d, eyeball smoothed line.
- Bio-age breakdown numbers sum to ±0.1 y of the headline.

---

## Rollout order & checkpoints

| # | Batch | Approx. files touched | Risk |
|---|-------|-----------------------|------|
| 1 | Meals overhaul | ~15 (migration, 3 shared, 4 server fns, 4 iOS files, 2 web files) | Medium — new bucket + camera perms |
| 2 | UX polish | ~20 (many small edits) | Low |
| 3 | Targets/trends/chat | ~18 (migration, onboarding, 2 new routes/views, chat context) | Medium — profile migration |
| 4 | Supplements/weight/insights | ~14 (2 migrations, notifs, charts) | Medium — notification perms |

Between each batch: build + smoke test + brief demo note in chat before starting the next. If any batch fails verification, I stop and fix before continuing — no half-shipped features.

## Technical notes

- iOS deployment target stays 17.0.
- New Info.plist keys needed in Batch 1: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`; Batch 4: notifications is handled at runtime auth request.
- All AI calls surface 429/402 → user-facing toast; no silent failures.
- No new npm packages needed on web except `react-hotkeys-hook` (Batch 2) and `@zxing/browser` fallback if `BarcodeDetector` unavailable (Batch 1).
- No new SPM packages on iOS — camera, barcode, notifications all native.

## Deliverable

Approving this plan starts **Batch 1**. After it builds and I've smoke-tested Meals end-to-end, I'll message you before moving to Batch 2.
