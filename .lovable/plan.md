## Goal

Apply the same Save button behaviour from the Log page everywhere the app has a form-style Save button:
- Button is **disabled and labeled "Saved ✓"** (secondary variant) when there are no unsaved edits.
- Becomes the primary "Save …" button as soon as any field changes.
- Shows "Saving…" while in-flight.
- Inline status next to button: amber "Unsaved changes" when dirty, muted "All changes saved · 2 min ago" otherwise (auto-ticking).
- Card briefly gets a green ring/flash on successful save.

## Step 1 — Extract a shared SaveBar

Move the helpers currently defined inline in `src/routes/_authenticated/log.tsx` into a new shared module so every screen uses the exact same UX:

- New file: `src/components/save-bar.tsx`
  - Exports `SaveBar` (same props/markup as today's version in `log.tsx`).
  - Exports `timeAgo(d)` and `useTick(ms)` helpers.
  - Exports a small `useSaveFlash()` hook returning `{ flash, trigger }` with the same 800 ms green ring (`ring-2 ring-green-500/60 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]`) used today, so call sites just spread `className={cn("transition-shadow", flash && flashRingClasses)}` onto the Card.
- Update `src/routes/_authenticated/log.tsx` to import from `@/components/save-bar` and delete the inline copies. Behaviour unchanged.

## Step 2 — Apply to other Save buttons

### `src/routes/_authenticated/settings.tsx`
Two cards already track dirty state (`profileDirty`, `baselineDirty`) and snapshots (`initialProfile`, `initialBaseline`). For each:
- Add `lastSavedAt` state, set from `profile.updated_at` on hydrate and to `new Date()` on `onSuccess`.
- Add `useSaveFlash()` and apply the flash ring to the Card.
- Replace the bare `<Button>` with `<SaveBar isDirty={profileDirty} isPending={saveProfile.isPending} isSaved={hydrated} lastSavedAt={lastSavedAt} dirtyLabel="Save" />` (and `"Save baseline"` for the baseline card). Wrap each card body in a `<form onSubmit>` that calls `mutate()` so SaveBar's `type="submit"` works (matches the Log page pattern).

### `src/routes/_authenticated/community.$groupId.settings.tsx`
Rename/icon card:
- Compute `isDirty = currentName !== group.name || currentIcon !== (group.icon ?? "👥")`.
- Track `lastSavedAt` (seed from `group.updated_at` if present, otherwise null; set to `new Date()` on success).
- Add flash ring on the Details card.
- Replace the rename Button with `<SaveBar dirtyLabel="Save" … />` inside a `<form onSubmit>`.

### `src/routes/_authenticated/meals.tsx` (MealCard / SnackCard editor)
Each meal card has its own description + macro fields and a save mutation:
- Build a snapshot string from `[description, kcal, protein, carbs, fat]` on hydrate from `meal` (and on `onSuccess`), derive `isDirty`.
- Add `lastSavedAt` (from `meal.updated_at` if available, else null; updated on success).
- Add `useSaveFlash()` + ring on the meal card.
- Replace the current `<Button>Save</Button>` with `<SaveBar dirtyLabel="Save" …/>`. Keep the existing "AI estimate" and "Delete" buttons next to it unchanged.
- The mutation continues to take `"manual"` as source on the button submit path.

## Out of scope

- `src/routes/_authenticated/import.tsx` — the Save button there commits a one-shot extracted screenshot result and then clears the form. There's no persistent "saved" state to reflect, so it stays as-is.
- All non-form action buttons ("Regenerate", "Remove", "Leave group", "Download my data", "Add", etc.) keep their current behaviour — the Log Save UX only applies to edit-and-save forms.

## Technical notes

- New module path: `src/components/save-bar.tsx`. Imported as `import { SaveBar, useSaveFlash } from "@/components/save-bar"`.
- No schema or backend changes. `lastSavedAt` is purely client-side; we seed it from `updated_at` columns that already exist on `profiles`, `meals`, and `groups` rows where available, otherwise from the moment of a successful in-session save.
- No new dependencies.
