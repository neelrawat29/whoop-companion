## Goal

Let you see the full, "ready" Biological Age experience (animated dial, trend, breakdown, helping/hurting, confidence) without needing 30 days of real logs — by adding a demo-data preview mode.

## Approach

Add a `?demo=1` query parameter to `/insights/biological-age` that bypasses the server fetch and renders the page with realistic mock data. Nothing about the real data path, server functions, or DB changes — purely a frontend preview switch.

## Changes

**`src/routes/_authenticated/insights.biological-age.tsx`**
1. Read `demo` from `Route.useSearch()` (add a `validateSearch` for `{ demo?: boolean }`).
2. When `demo` is true:
   - Skip `useQuery` for `getBiologicalAge` / `getBiologicalAgeHistory` (or keep them disabled).
   - Substitute a `mockResult` (ready: true) and `mockHistory` (90 points) built inline.
   - Show a small dismissible "Demo data" badge near the header so it's obvious this isn't real.
3. Add a subtle "Preview with sample data" link in the empty-state card (only visible when `!result.ready`) that navigates to `?demo=1`. Keeps the real empty state intact for users with no data, but gives a one-click way in.

**Mock data shape** (matches `BioAgeResult` + `HistoryPoint[]`):
- chronological: 34, biological: 30.8, delta: -3.2, confidence: 0.82, daysLogged: 28
- domainTotals: Sleep -1.4y, Recovery -0.9y, Activity -0.6y, Nutrition -0.2y, Lifestyle -0.1y
- modifiers: helping = ["Consistent 7.5h+ sleep", "HRV trending up", "Protein target hit"]; hurting = ["Late bedtime 2 nights", "Alcohol 3 drinks/week"]
- history: 90 days, smooth wave between ~32.5 and ~30.5 ending at 30.8, with chronological=34 constant

## Out of scope

- No backend changes, no migrations, no new packages.
- No changes to scoring logic or server functions.
- Demo mode is a URL flag only — not persisted, not a global toggle.
