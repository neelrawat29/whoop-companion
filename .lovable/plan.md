### Goal
Remove "Cool room" and "Screen cutoff" fields from the Evening check-in section on the Log page.

### Changes
- **State cleanup** — Remove `cool` and `screen` state variables, their `useEffect` setters, and their keys from the `habits_log` upsert payload (`cool_room`, `screen_cutoff`).
- **JSX cleanup** — Remove the "Cool room" Switch row and the "Screen cutoff" TimeField.
- **Layout** — Reflow remaining fields:
  - Top row: Drinks, Hydration (2 fields, no longer needs a 4-column grid with the switch).
  - Time pickers: Bedtime, Last caffeine, Last meal (3 fields).
- **Imports** — Keep `Switch` import (used elsewhere in app) and `Sun` icon (used by Work today buttons). Remove `screen`/`cool` usage only.

### File
- `src/routes/_authenticated/log.tsx`

### Out of scope
- No database migration — `habits_log.cool_room` and `habits_log.screen_cutoff` columns stay; we simply stop writing them from this form.