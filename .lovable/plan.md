# Weight page polish

Three focused tweaks to `src/routes/_authenticated/weight.tsx` and `src/components/weight/BodySilhouetteRing.tsx`. No backend/schema changes.

## 1. Unify date pickers

Replace the raw `<Input type="date" />` in both dialogs with the shared `DatePicker` from `@/components/ui/date-picker` (used in Log, Import, Settings) so the Weight page matches the rest of the app.

- **Log weight dialog**: `<DatePicker value={date} onChange={(d) => setDate(d || today())} disableFuture />`
- **Goal dialog**: `<DatePicker value={date} onChange={setDate} allowFuture disableFuture={false} showYear />` — the goal date is in the future, so future dates must be allowed and the label should show the year.

## 2. Goal date stays blank when optional

Today the Goal dialog seeds `date` from `currentGoalDate ?? ""`, but `DatePicker` always renders a date (defaults to today internally) and there is no clear "unset" affordance. Fix:

- Track the goal date as `string | null`.
- Render the field as a labeled row with two states:
  - **No date set**: a muted "Set target date (optional)" button that opens the picker.
  - **Date set**: the `DatePicker` plus a small "Clear date" ghost button that resets back to `null`.
- Only send `weight_goal_date` on save when non-null; otherwise send `null`. The DB column already accepts null.

This guarantees no accidental "today" gets written when the user just wants a target weight without an ETA.

## 3. Redesign silhouette + ring

The current silhouette path is a crude blob and the ring uses a flat 2-stop gradient. Rework `BodySilhouetteRing.tsx` for a cleaner, more premium look:

**Silhouette** — replace the single `<path d="...">` with a cleaner anatomical figure built from a few primitive shapes (head circle, neck, torso, arms, legs) using rounded line caps, so it reads as a person at any scale and at low opacity. Keep the subtle scale animation between start and goal but tighten the range (0.94 → 1.02) and animate width independently from height for a more natural slimming effect.

**Ring** — upgrade visuals:
- Conic-style gradient feel via an SVG `linearGradient` rotated to match the stroke direction, plus a soft inner shadow ring (a second circle at lower opacity inside the track) for depth.
- Add small tick marks at 0/25/50/75/100% around the track.
- Add a glowing dot marker at the current progress position (computed from `pct`) using `cx/cy = cx + r*cos(θ), cy + r*sin(θ)` with `θ = -π/2 + 2π·pct/100`.
- Use `--primary` → `--recovery-high` already in tokens; no new colors.

**Center readout** — keep current/delta/percent stack but:
- Bigger, lighter weight numeral (`text-5xl font-semibold`) with unit suffix in muted tone.
- Delta badge becomes a pill with arrow icon (↓ green / ↑ red / – muted) using existing recovery tokens.
- "X% to {goal}" line gets a tiny inline ring icon for cohesion.

## Files touched

- `src/routes/_authenticated/weight.tsx` — swap two date inputs, refactor goal date state to nullable with clear/set affordance.
- `src/components/weight/BodySilhouetteRing.tsx` — rewrite SVG (silhouette + ring + readout).

## Out of scope

- No DB migration, no server function changes, no new dependencies, no nav changes.
