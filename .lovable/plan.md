### Goal

Optimize the Evening check-in on the Log page to keep only fields with proven impact on next-day HRV/recovery. No new fields added — trim only.

### Fields to keep (recovery-predictive)

- **Drinks** (alcohol) — strong HRV suppressor
- **Last caffeine time** — affects sleep latency
- **Last meal time** — late eating hurts deep sleep
- **Bedtime** — sleep timing/consistency
- **Hydration (ml)** — recovery cofactor
- **Work today** (home/office/context) — kept per user
- **Note** — free-form context

### Fields to remove

- **Wake time** — Whoop tracks it; logging it in the evening is awkward.

(Supplements section already removed.)

### Layout cleanup

- Re-flow the time pickers grid from 5 → 4 items: Bedtime, Screen cutoff, Last caffeine, Last meal.
- Keep existing two-column responsive structure; no visual redesign.

### Files to change

- `src/routes/_authenticated/log.tsx` — `EveningCard`:
  - Remove `wake` state, its `useEffect` setter, and the `wake_time` field in the upsert payload.
  - Remove the Wake time `<TimeField>` from the JSX.
  - Remove unused `Sun` icon import only if no other usage remains (it's still used by the Work today buttons, so keep it).

### Out of scope

- No DB migration. `habits_log.wake_time` column stays; we simply stop writing to it from this form.
- No changes to Today page or Supplements page.
- No new fields (per user choice).