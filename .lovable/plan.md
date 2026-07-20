# Reduce logging friction

Two features, both use a "review & confirm" pattern so nothing is written without a user tap.

---

## 1. HealthKit auto-sync (iOS only)

Pull metrics Apple Health already has, pre-fill them into the day, let the user confirm.

**Metrics pulled**
| Metric | HealthKit type | Target table/field |
|---|---|---|
| HRV | `heartRateVariabilitySDNN` (last night's avg) | `daily_entries.hrv` |
| Resting HR | `restingHeartRate` | `daily_entries.rhr` |
| Sleep hours | `sleepAnalysis` (asleep segments) | `daily_entries.sleep_hours` |
| Body mass | `bodyMass` | `weight_entries.weight_kg` |
| Water | `dietaryWater` (day total) | `habits_log.hydration` |
| Steps / active energy (bonus) | `stepCount`, `activeEnergyBurned` | shown in Insights only |

**Flow**
- New file `ios-native/WhoopCompanion/Health/HealthKitManager.swift`: request read authorization for above types, expose async `fetchToday() -> HealthSnapshot`.
- Add `NSHealthShareUsageDescription` in `Info.plist` + `project.yml`; entitlement `com.apple.developer.healthkit`.
- Settings gets a new "Apple Health" row: toggle on → prompt HealthKit permission → store `healthkitEnabled` in `UserDefaults`.
- On app foreground and on Home pull-to-refresh, if enabled, run `fetchToday()`. Diff against today's `daily_entries` / `habits_log` / `weight_entries`. If any field is missing OR differs and user hasn't manually edited it, mark as "suggested".
- Home shows a compact "From Apple Health" review card at top when suggestions exist: chips for each field ("HRV 62 ms", "Sleep 7.4 h", "Weight 74.2 kg"), one **Confirm all** button + per-chip tap to edit inline. Nothing writes until Confirm.
- After confirm, upsert via existing Supabase clients; add `source: "healthkit"` to `daily_entries.source` so we can distinguish from manual/screenshot later.

**Non-goals for v1**: background delivery, historical backfill, writing back to HealthKit. All pull-only, foreground-triggered.

---

## 2. End-of-day recap card (web + iOS)

A single screen at end of day that surfaces every missing field with smart defaults pre-filled; user swipes/scrolls through and confirms.

**Trigger**
- iOS: local notification at user-configurable time (default 21:00) → deep-link into recap. Also accessible from Home as a "Close today" button that appears after 18:00 if anything's missing.
- Web: banner on Home after 18:00 with "Close today" CTA.

**Content (only shows sections with missing data)**
1. **Whoop metrics** — if `daily_entries` empty: prompt for screenshot upload OR (iOS) already-filled from HealthKit.
2. **Meals** — list logged meals; if a slot is empty, show "Skip / Log now / Repeat yesterday's [breakfast]" (uses existing recent-meals endpoint).
3. **Water** — slider pre-filled with 7-day avg (or HealthKit total on iOS).
4. **Weight** — optional field pre-filled with last entry; user can tap "Same as yesterday" or type new.
5. **Energy & mood** — 1-10 sliders pre-filled with 7-day median.
6. **Bedtime target** — pre-filled from profile `sleep_target_hours`.

Each row has an "edit" state and a "confirm" checkmark. Bottom sticky **Save all** button writes everything in one batched call.

**Backend**
- New server fn `getRecapDefaults()` in `src/lib/recap.functions.ts` — returns `{missing: [...], defaults: {...}}` by querying today's rows + 7-day averages for that user.
- New `saveRecap()` server fn — accepts one payload, upserts `daily_entries`, `habits_log`, `weight_entries`, `meals` in a single handler; skips fields the user didn't touch.
- Mirror both as `/api/public/ios/recap-defaults` and `/api/public/ios/save-recap` for the iOS app.

**Web UI**
- `src/routes/_authenticated/recap.tsx` — new route.
- Reused components: `DailyRings`, existing meal quick-log presets, sliders from Log page. No new visual system.

**iOS UI**
- `Features/Recap/RecapView.swift` + `RecapViewModel.swift`.
- Presented as a full-screen sheet from Home when the notification is tapped or the "Close today" button is pressed.

---

## Technical details

**Schema** — no new columns; existing tables cover everything. Only additions:
- `profiles.recap_notification_hour int default 21` (optional, for iOS notification scheduling).
- Migration includes GRANTs and preserves existing RLS.

**Auth / API** — recap endpoints follow the existing dual pattern: `createServerFn` with `requireSupabaseAuth` for web + `/api/public/ios/*` routes for iOS (verify Supabase bearer inside handler).

**HealthKit isolation** — HealthKit code stays in `Health/` and behind `#if canImport(HealthKit)` so simulator builds without HealthKit still compile.

**No auto-writes** — every write requires an explicit tap. Matches "confirm before save".

**Files touched**
- New: `src/lib/recap.functions.ts`, `src/lib/recap.shared.ts`, `src/routes/_authenticated/recap.tsx`, `src/routes/api/public/ios/recap-defaults.ts`, `src/routes/api/public/ios/save-recap.ts`, `ios-native/.../Health/HealthKitManager.swift`, `ios-native/.../Features/Recap/RecapView.swift`, `ios-native/.../Features/Recap/RecapViewModel.swift`, one migration.
- Edited: `src/routes/_authenticated/index.tsx` (banner), `ios-native/.../Features/Home/HomeView.swift` (HealthKit review card + Close today button), `ios-native/.../Features/Settings/SettingsView.swift` (Health toggle + notification time), `ios-native/project.yml` + `Info.plist` (usage string + entitlement), `ios-native/.../WhoopCompanionApp.swift` (notification registration).

**Order of build**
1. Migration + recap server fns + iOS API routes.
2. Web recap route + Home banner.
3. iOS RecapView + Home "Close today" button.
4. HealthKit manager + Settings toggle + Home review card.
5. iOS local notification scheduling.

---

## Out of scope (future batches)
Voice log, Siri Shortcuts, Home widget, Watch complication, auto-log recurring meals, water inferred from meals. All good candidates once the two above land and we see which friction remains.
