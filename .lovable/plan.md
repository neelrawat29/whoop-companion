## Problem

The "Today" count and the home-page tile both read `habits_log.supplements` (taken today), not your saved catalog (`user_supplements`). When you add a supplement to the catalog, nothing is marked taken — you also have to tap its chip. The tap affordance isn't obvious, so it looks broken.

We'll keep the catalog vs. taken split (per your choice), but make the tap-to-log action unmistakable and reachable from the add/edit flow.

## Changes

### 1. Make chips clearly tappable on the Today card (`src/routes/_authenticated/supplements.tsx`)
- Rename card header to "Taken today" with helper text: "Tap a chip to mark it taken. Tap again to undo."
- Replace pill chips with a tile grid: each tile shows the supplement name, a visible empty/filled checkbox icon, and uses `aria-pressed` for state. Filled tiles use the primary color; empty tiles show a dashed border so "not yet taken" reads as an action, not a static label.
- Show count as "`X of Y` taken today" (Y = catalog size). If catalog is empty, show CTA to add one.
- Add a small "Mark all taken" / "Clear all" link row when catalog has ≥2 items.
- Optimistic update on toggle so the tile flips immediately (no perceived lag that makes people re-tap).

### 2. Add an explicit "Mark taken today" control in the Add/Edit dialog
- In `SupplementDialog`, add a checkbox: "Mark as taken today" (default ON for new items, OFF for edits).
- After a successful save/update, if checked, upsert the name into today's `habits_log.supplements` in the same mutation. Invalidate `["habits", date]` and `["supplements-history"]`.
- This means the common "I just took this new thing" flow now logs in one step, while the catalog/taken split is preserved.

### 3. Home-page tile copy (`src/routes/_authenticated/index.tsx`)
- Keep the data source (`habits.supplements`) but change the description from "X taken today" wording so it matches the Supplements page ("`X of Y` taken today"). Empty state CTA links to `/supplements` with text "Log what you took".

### 4. No DB / no schema changes
The data model is correct; this is purely a UX clarity fix plus a convenience toggle in the dialog.

## Files touched
- `src/routes/_authenticated/supplements.tsx` — Today card redesign, optimistic toggle, dialog "Mark taken today" checkbox + extended save mutation.
- `src/routes/_authenticated/index.tsx` — tile copy + empty-state CTA.

## Out of scope
- Quantities / per-dose tracking, time-of-day logging, reminders. Say the word if you want any of these next.
