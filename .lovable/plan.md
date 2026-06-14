### Goal
Remove the "Supplements taken" section from the Log page evening check-in, since a dedicated Supplements page already handles logging and management.

### What to change
In `src/routes/_authenticated/log.tsx`, inside the `EveningCard` component:
1. Remove the `supplements` state and `setSupplements` call in `useEffect`.
2. Remove the `suppList` query (lines 173-179) and its import dependencies.
3. Remove the entire "Supplements taken" UI block (lines 271-294).
4. Remove `supplements` from the `habits_log` upsert mutation payload (line 214).

### No other files affected
The dedicated Supplements page (`/supplements`) remains unchanged and continues to handle supplement logging and management.

### Result
The Log page will no longer show the supplement toggle chips. Users log supplements via the dedicated Supplements page instead.