# Fixes & improvements

## 1. Supplements page — nutrition fields + reusable presets

The `user_supplements` table currently only stores `name`. Extend it so each supplement is a reusable preset with its nutritional info filled in once.

**Schema change** (`user_supplements`):
- Add columns: `brand text`, `serving_size text` (e.g. "1 capsule"), `calories numeric`, `protein_g numeric`, `carbs_g numeric`, `fat_g numeric`, `notes text`, plus a flexible `nutrients jsonb` (for vitamins/minerals like Vitamin D 1000 IU, Magnesium 200 mg) so users can add arbitrary nutrients without more columns.
- Keep RLS scoped to `auth.uid()` (already in place).

**UI** (`src/routes/_authenticated/supplements.tsx`):
- Replace the simple "Add" input with an **Add/Edit supplement** dialog containing: name, brand, serving size, calories/protein/carbs/fat, and a dynamic "Nutrients" list where the user can add rows of `{name, amount, unit}` (saved into `nutrients` jsonb).
- Each chip in the "Manage your list" section gets an **Edit** action (opens the same dialog pre-filled) alongside the existing remove.
- The "Today" chips stay tap-to-log; tapping a chip's small info icon opens a read-only summary of the saved nutrition. Saved supplements are reused across days (already true via `user_supplements` — this just makes them richer).
- History section unchanged.

## 2. Fix time input (Bedtime, Last caffeine, Last meal)

Current `TimePicker` (`src/components/ui/time-picker.tsx`) auto-commits after 2 digits and jumps focus, which fights normal typing (e.g. typing "11" while "10" is pre-seeded behaves unpredictably, and there is no way to type a 24h hour like "23").

Rewrite the picker to be input-friendly:
- Use a single text input that accepts free-form typing: `"11pm"`, `"11:30 pm"`, `"23:15"`, `"7a"`, etc. Parse on blur / Enter, not per keystroke. No auto-focus jump.
- Show the parsed result formatted as `11:00 PM` once committed; clear button to reset.
- Keep AM/PM toggle buttons next to the input for quick switching after a value is set.
- Drop the "seed default time on first click" behavior — empty stays empty until the user types or picks AM/PM.
- Keep the same `value` (24h `HH:MM`) / `onChange` contract so callers (`log.tsx`) don't change.

## 3. Morning check-in — remove RHR

In `src/routes/_authenticated/log.tsx` `MorningCard`:
- Remove the RHR field, its state (`rhr`, `setRhr`), the `rhr` entries in `snapshot`/`current`, and the `rhr` column from the upsert payload (send `rhr: null` to clear any prior value, or simply omit — column stays in DB, unused).
- Update the grid from 5 columns to 4.
- Also remove the `RHR` text in the history row summary on the same page.

No DB change. The `rhr` column stays for historical data; new entries just won't write it.

## 4. Evening check-in — add Strain field

In `src/routes/_authenticated/log.tsx` `EveningCard`:
- Add a "Strain" numeric input (0–21, one decimal — Whoop's strain scale).

**Schema change** (`habits_log`): add `strain numeric` column (nullable).

Wire it into the same load/snapshot/save flow as the other habits fields, with its own icon (e.g. `Activity` from lucide-react).

---

## Technical notes
- Two migrations (or one combined): add columns to `user_supplements` and add `strain` to `habits_log`. No new tables, so existing RLS/grants still cover the new columns.
- `src/integrations/supabase/types.ts` is auto-regenerated after the migration runs.
- Time picker rewrite is internal to `src/components/ui/time-picker.tsx`; no API changes for callers.
