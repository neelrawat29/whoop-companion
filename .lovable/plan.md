# Whoop Companion — Personal MVP

A private, login-protected app to log your daily Whoop metrics alongside habits, get a recovery-based training recommendation each morning, and see simple stats that connect the dots.

## Core daily flow

1. **Morning check-in** — Recovery %, HRV, RHR, Sleep score, Sleep hours.
2. **Training recommendation** — Rule-based: ≥67% push, 34–66% moderate, <34% rest. Editable thresholds later.
3. **Evening check-in** — Habits + short note.
4. **Insights** — Trends, averages, simple correlations, streaks.

## Pages

- `/auth` — Email/password + Google login (Lovable Cloud).
- `/` (today) — Morning + evening cards for today, training recommendation, "what changed vs yesterday."
- `/log` — Calendar / list view of past entries, edit any day.
- `/import` — Three input methods (see below).
- `/insights` — Charts + correlation summaries.
- `/settings` — Threshold tuning, habit toggles, export data.

## Data entry — all three methods

- **Manual form** — Default; ~15 sec morning, ~30 sec evening.
- **CSV import** — Upload Whoop's exported CSV (physiological_cycles.csv, sleeps.csv); parse client-side and upsert by date.
- **Screenshot AI** — Upload a Whoop app screenshot; Lovable AI Gateway (Gemini Flash, vision) extracts Recovery/HRV/RHR/Sleep into the form for confirmation before save.

## Habits tracked

- **Alcohol & caffeine**: drinks count, last caffeine time.
- **Sleep hygiene**: bedtime, wake time, screen cutoff time, room cool (y/n).
- **Nutrition**: last meal time, hydration (glasses), supplements taken (multi-select chips: magnesium, creatine, etc., user-editable list).
- Plus: mood 1–5, energy 1–5, optional 1-line note.

## Insights (simple stats only)

- 7/30/90-day averages for Recovery, HRV, RHR, Sleep.
- Line charts (Recharts) per metric with rolling average.
- **Correlation cards**: for each habit, compare avg recovery on days-with vs days-without (e.g. "Recovery avg 58% after alcohol vs 71% without — −13 pts over 42 days"). Only show when sample size ≥5 each side.
- Streaks: consecutive green-recovery days, consecutive logged days.

## Tech approach

- **Stack**: TanStack Start + Tailwind + shadcn/ui + Recharts.
- **Backend**: Lovable Cloud (auth + Postgres + storage for screenshots).
- **AI**: Lovable AI Gateway via a `createServerFn` for screenshot extraction.

## Database schema (Lovable Cloud)

- `profiles` (id → auth.users, display_name, timezone, thresholds jsonb)
- `daily_entries` (id, user_id, date UNIQUE per user, recovery, hrv, rhr, sleep_score, sleep_hours, source enum[manual|csv|screenshot])
- `habits_log` (id, user_id, date, drinks, last_caffeine_time, bedtime, wake_time, screen_cutoff, last_meal_time, hydration, supplements text[], mood, energy, note, cool_room bool)
- `user_supplements` (id, user_id, name) — user-managed list for the chip picker.

RLS: every row scoped to `auth.uid()`. Standard grants for `authenticated` + `service_role`.

## Build roadmap

1. Enable Lovable Cloud, scaffold auth (email + Google), profile.
2. Schema + RLS migration.
3. Today page: morning + evening forms, training recommendation card.
4. Log page: list/calendar + edit.
5. Insights page: averages, charts, correlation cards, streaks.
6. CSV import.
7. Screenshot AI extraction via server fn + Lovable AI.
8. Settings: threshold + supplement management, data export (JSON/CSV).

## Out of scope (v1)

- AI-written weekly summaries (you chose simple stats).
- Sharing / multi-user / coach views.
- Real Whoop API (none exists publicly).
- Push notifications / reminders (can add as PWA later).
