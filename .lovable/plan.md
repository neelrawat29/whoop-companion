### Summary
Enable each Settings category Save button only when the user has actually changed one or more fields in that category.

### Current state
The Settings page has two save-button categories:
- **Profile & thresholds** — `display_name`, `threshold_push`, `threshold_rest`
- **Body & baseline** — `date_of_birth`, `sex`, `height_cm`, `weight_kg`, `resting_hr_baseline`

Both Save buttons are always enabled (except during the pending network state), so users can click Save even when nothing has changed.

### Proposed change
1. Add two snapshot states: `initialProfile` and `initialBaseline`.
2. During hydration, copy the loaded profile values into both the current form state and the corresponding snapshot.
3. Derive `profileDirty` and `baselineDirty` by comparing current local state to the snapshot.
4. In each mutation `onSuccess`, update the snapshot to the just-saved values so the button immediately disables after a successful save.
5. Wire `disabled={isPending || !isDirty}` on both Save buttons.

### Files modified
- `src/routes/_authenticated/settings.tsx`

### No new dependencies or routes.
No DB, auth, or API changes required.