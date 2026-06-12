## Goal

Turn **Today** into a read-only daily snapshot with four summary cards (Recovery, Habits, Supplements, Meals). Move all input/editing into the **Log** page.

## 1. Today page (`src/routes/_authenticated/index.tsx`) — read-only

Replace `MorningCard` and `EveningCard` forms with four compact summary cards. Each card has a header and a small "Edit" / "Log" link that routes to the relevant section on `/log`.

- **Recovery snapshot** — keeps existing recommendation banner + Recovery/HRV/RHR/Sleep metrics. Link: "Edit → /log#morning".
- **Habits snapshot** — drinks, hydration, caffeine cutoff, bedtime/wake, screen cutoff, cool room, work location (Home/Office/Off badge), mood, energy, note. Renders "—" for missing fields. Link: "Edit → /log#evening".
- **Supplements taken today** — pulls from `habits_log.supplements`; shows count + chip list (read-only); empty state "None logged yet". Link: "Log → /supplements".
- **Today's meals** — pulls from `meals` for today; shows per-slot lines (Breakfast / Lunch / Dinner / Snacks) with kcal each + day total (kcal + macros). Empty state "No meals logged". Link: "Log → /meals".

All four cards stack on mobile, 2-col grid on `md`. No form controls anywhere on Today.

## 2. Log page (`src/routes/_authenticated/log.tsx`) — primary logging surface

Restructure into two stacked sections at the top, then the 90-day history below.

- **Section A — Morning check-in** (id="morning"): the existing `MorningCard` form (Recovery, HRV, RHR, Sleep score, Sleep hours), defaulting to today's date. Add a date picker so the user can log/edit any date.
- **Section B — Evening check-in** (id="evening"): the existing `EveningCard` form, including the work-location toggle and the inline supplement chips, also bound to the selected date.
- Below: the existing 90-day history list (unchanged) — clicking a row sets the form's date so the user can edit past days.

Move `MorningCard`, `EveningCard`, and the `Field` helper from `index.tsx` into `log.tsx` (or extract them to `src/components/log/` if it keeps `log.tsx` readable). Both cards keep their current upsert behavior on `daily_entries` / `habits_log` keyed by `(user_id, entry_date)`.

## 3. Nav copy

`AppShell.tsx` — no structural change. Today's subtitle changes from "Log your morning and evening check-ins" to "Your daily snapshot." Log's subtitle changes to "Log today, edit any past day."

## Out of scope

No DB changes. No new routes. Supplements/Meals pages stay as-is (they remain the place to manage the supplement catalog and log meals; the inline supplement chips on the Evening form stay because they're the fast path for marking what was actually taken that day).
