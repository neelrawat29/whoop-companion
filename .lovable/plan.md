# Weight Tracking Page

A new authenticated page at `/weight` for logging weight over time, with two complementary visualizations (analytical chart + emotional silhouette ring) and goal projection.

## User-facing features

**Quick log**
- One-tap "Log weight" with today's date prefilled; date is editable
- Inline edit/delete on past entries
- One entry per day (upsert) to keep the chart clean

**Visualizations (two stacked panels)**
1. **Line chart with trend**
   - Raw daily points (faint dots) + 7-day moving average (bold line)
   - Horizontal dashed goal-weight line
   - Shaded band between current and goal
   - Range toggle: 1M / 3M / 6M / 1Y / All
2. **Body silhouette + progress ring**
   - SVG silhouette that subtly scales/morphs between start weight → current → goal
   - Circular ring around it showing % progress toward goal
   - Center stat: current weight (big), delta vs start (small, color-coded)

**Goal & ETA card**
- Set target weight + target date
- Shows: kg to go, % complete, projected ETA from 14-day trend slope, on-track / off-track badge
- If trend is flat or wrong direction, show "Trend stalled" instead of a misleading ETA

**Units**
- Toggle in page header: kg ⇄ lbs (also persisted to profile for app-wide consistency)
- All values stored canonically in kg; conversion done in the UI

**Empty / first-run state**
- Friendly prompt with a single "Log your first weight" CTA
- Optional starting-weight + goal capture in the same modal

## Technical plan

**Database (one migration)**
- New table `public.weight_entries`: `user_id`, `entry_date` (date), `weight_kg` (numeric), unique on `(user_id, entry_date)`
- New columns on `public.profiles`: `weight_goal_kg numeric`, `weight_goal_date date`, `weight_unit text` (`'kg'|'lbs'`, default `'kg'`)
- RLS: user-owns-rows policies on `weight_entries`; standard GRANTs to `authenticated` + `service_role`
- `updated_at` trigger via existing `set_updated_at()`

**Server functions** (`src/lib/weight.functions.ts`, `requireSupabaseAuth`)
- `listWeightEntries({ since? })` — returns entries asc by date
- `upsertWeightEntry({ entry_date, weight_kg })`
- `deleteWeightEntry({ entry_date })`
- `updateWeightGoal({ weight_goal_kg, weight_goal_date, weight_unit })`

**Route** `src/routes/_authenticated/weight.tsx`
- Loader uses `ensureQueryData` for entries + profile goal fields
- Components in `src/components/weight/`: `WeightChart.tsx` (recharts — already in app), `BodySilhouetteRing.tsx` (inline SVG), `GoalCard.tsx`, `LogWeightDialog.tsx`, `UnitToggle.tsx`
- Trend math (7-day MA, linear regression for ETA) in `src/lib/weight.ts` (pure, unit-tested-friendly)

**Nav**
- Add "Weight" link to `AppShell` nav between Meals and Supplements

## Out of scope (call out, don't build)
- Body fat %, waist, progress photos
- Apple Health / Google Fit imports
- Weekly email summaries
- Notifications/reminders

## Files touched
- `supabase` migration (new table + profile columns)
- `src/lib/weight.functions.ts` (new)
- `src/lib/weight.ts` (new — trend/ETA helpers)
- `src/routes/_authenticated/weight.tsx` (new)
- `src/components/weight/*` (new)
- `src/components/AppShell.tsx` (nav entry)
- `src/routeTree.gen.ts` (auto)
