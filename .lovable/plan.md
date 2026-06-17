# Evening UX + Supplement validation

## 1. Mood & Energy — segmented buttons with labels

In `EveningCard` (`src/routes/_authenticated/log.tsx`), replace the two numeric inputs with a reusable `<SegmentedScale>` component.

- **Energy 1–5**: Drained · Low · OK · Good · Great
- **Mood 1–5**: Awful · Low · OK · Good · Amazing

Behavior:
- 5 pill buttons in a row, equal width, current value highlighted in primary color.
- Tap selects; tap again clears (allows "no answer").
- Label under each button on desktop; on mobile, show only the word (or icon + word) to keep it one row.
- Stores the same `1..5` integer in `habits_log.mood` / `habits_log.energy` — no schema change.

New component: `src/components/ui/segmented-scale.tsx` (generic — takes `options: {value:number,label:string}[]`, `value`, `onChange`).

## 2. Time fields — wheel/scroller picker

Rewrite `src/components/ui/time-picker.tsx` as an iOS-style wheel picker, opened from a tap target that shows the current formatted time (e.g. `10:30 PM` or "Set time").

- Tap target → opens a `Popover` (desktop) / bottom `Drawer` (mobile, using existing `vaul`/`Drawer` if available, else Popover everywhere).
- Inside: three scrollable columns — **Hour** (1–12), **Minute** (00–59, step 5 for fast scroll; long-press / scroll to fine-tune to 1), **AM/PM**.
- Each column is a vertical snap-scroll list with the selected row centered and highlighted; flick to spin. Built with a plain scroll container + `scroll-snap-type: y mandatory` and `IntersectionObserver` (or scroll position math) to detect the centered item. No external dep.
- Footer: **Clear** and **Done**. "Now" shortcut button at the top.
- Keyboard accessible: up/down arrows on a focused column change selection; Enter commits.
- Same `value` (`HH:MM` 24h string | null) / `onChange` contract — no caller changes in `log.tsx`.
- Removes today's per-digit text input + auto-jump bugs entirely.

Callers (`Bedtime`, `Last caffeine`, `Last meal`) keep their existing `defaultHour` / `defaultPeriod` props as the initial wheel position when opening with no value.

## 3. Supplement validation — full stack

### Client (Zod) in `src/routes/_authenticated/supplements.tsx`

Add a `supplementSchema` validated on form submit; show inline errors under each field and disable Save until valid.

```
name:         string, trim, 1–60 chars, required
brand:        string, trim, 0–60 chars, optional
serving_size: string, trim, 0–30 chars, optional
calories:     number, 0–2000, optional
protein_g:    number, 0–500, max 1 decimal, optional
carbs_g:      number, 0–500, max 1 decimal, optional
fat_g:        number, 0–500, max 1 decimal, optional
notes:        string, 0–500 chars, optional
nutrients[]:  { name: 1–40 chars required,
                amount: number > 0 required,
                unit: enum(mg, mcg, g, IU, %DV) required }
```

**Unit dropdown**: replace any free-text unit field with a `<Select>` constrained to `mg | mcg | g | IU | %DV`. Default `mg`.

**Duplicate-name guard**: before insert, query `user_supplements` for `lower(name) = lower(input)` for the current user. If found, show a dialog: *"You already have 'Vitamin D'. Edit existing?"* with `Edit` (opens that row in the dialog) / `Cancel`. On Edit (existing flow) the duplicate check skips the current row.

### DB (CHECK constraints) — migration

Add backstop constraints to `public.user_supplements`:

```sql
ALTER TABLE public.user_supplements
  ADD CONSTRAINT user_supplements_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  ADD CONSTRAINT user_supplements_brand_len     CHECK (brand IS NULL OR length(brand) <= 60),
  ADD CONSTRAINT user_supplements_serving_len   CHECK (serving_size IS NULL OR length(serving_size) <= 30),
  ADD CONSTRAINT user_supplements_calories_rng  CHECK (calories IS NULL OR (calories >= 0 AND calories <= 2000)),
  ADD CONSTRAINT user_supplements_protein_rng   CHECK (protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 500)),
  ADD CONSTRAINT user_supplements_carbs_rng     CHECK (carbs_g   IS NULL OR (carbs_g   >= 0 AND carbs_g   <= 500)),
  ADD CONSTRAINT user_supplements_fat_rng       CHECK (fat_g     IS NULL OR (fat_g     >= 0 AND fat_g     <= 500)),
  ADD CONSTRAINT user_supplements_notes_len     CHECK (notes IS NULL OR length(notes) <= 500);
```

Plus a partial unique index for case-insensitive duplicate prevention per user:

```sql
CREATE UNIQUE INDEX user_supplements_user_name_uniq
  ON public.user_supplements (user_id, lower(name));
```

If existing rows violate the new index, the migration will fail — we'll surface that and resolve before retry.

## Technical notes
- One migration: CHECK constraints + unique index on `user_supplements`. No schema change for evening UX.
- New files: `src/components/ui/segmented-scale.tsx`; rewrite of `src/components/ui/time-picker.tsx`.
- Edits: `src/routes/_authenticated/log.tsx` (replace mood/energy inputs), `src/routes/_authenticated/supplements.tsx` (Zod + unit Select + duplicate guard).
- No API/contract changes for `TimePicker` callers.
