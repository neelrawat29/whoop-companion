## Goal

Replace every ugly native `<input type="date">` and `<input type="time">` in the app with two reusable, customer-friendly components inspired by the "Tactile segmented pickers" direction.

## New shared components

### 1. `src/components/ui/date-picker.tsx` — `<DatePicker />`

A pill-shaped trigger with quick step controls, plus a popover calendar.

- Trigger UI: rounded-full white pill, border, soft shadow. Shows the selected date as `Mon, Jun 14` (or `Today` / `Yesterday` when applicable). Three icon buttons inside the pill:
  - `‹` previous day
  - `›` next day (disabled when at today, since most date pickers in this app browse past days)
  - calendar icon → opens a shadcn `<Popover>` with shadcn `<Calendar>` for jumping to any day
- Inside the popover, a row of quick chips: **Today**, **Yesterday**, **7 days ago**.
- Props: `value: string` (YYYY-MM-DD), `onChange(next)`, `disableFuture?: boolean` (default true), `label?`, `className?`.
- Built on existing shadcn `Popover` + `Calendar` + `Button`; uses `date-fns` (already used elsewhere via `format`).

### 2. `src/components/ui/time-picker.tsx` — `<TimePicker />`

The segmented HH : MM + AM/PM control from the prototype, plus an empty "Set time" state.

- Filled state: rounded-2xl slate-50 chip with two 2-digit numeric inputs separated by `:` and a vertical AM/PM toggle (active = primary, inactive = muted). Focus ring in primary color.
- Empty state: dashed border chip, "Set time" placeholder with `+` icon; clicking focuses the hour input and seeds a sensible default (e.g. current time or `10:00 PM` for Bedtime).
- Auto-advances from hour to minute after 2 digits, accepts paste of `22:30` / `10:30 PM`, clamps to valid ranges.
- Props: `value: string | null` (24h `HH:MM`), `onChange(next: string | null)`, `defaultPeriod?: 'AM' | 'PM'`, `label?`, `placeholder?`, `className?`.
- Internally stores hour (1–12), minute (0–59), period; emits 24h `HH:MM` (the schema used by the existing inputs).

Both components honor the design system tokens (no hardcoded hex). Slate/blue used in the prototype maps to existing `--background` / `--card` / `--primary` tokens — final implementation uses those instead of literal `bg-blue-600`.

## Wiring into existing pages

1. **`src/routes/_authenticated/log.tsx`** — top-right Date field → `<DatePicker disableFuture />`. Bedtime, Wake time, Last caffeine, Last meal, Screen cutoff → `<TimePicker />` with sensible default periods (Bedtime/Screen cutoff/Last meal default PM, Wake AM, Last caffeine PM).
2. **`src/routes/_authenticated/settings.tsx`** — Date of birth → `<DatePicker />` (allows past dates only; opens calendar with year navigation).
3. **`src/routes/_authenticated/import.tsx`** — any date inputs (need to confirm during build) → `<DatePicker disableFuture />`.

No business-logic changes — value shapes stay the same (`YYYY-MM-DD` for dates, `HH:MM` for times) so the existing mutations and zod validators keep working.

## Technical notes

- Reuse shadcn `Calendar` (already in the project) and add `pointer-events-auto` to its className inside popovers as required by the project pattern.
- `DatePicker` uses controlled state; supports keyboard typing in the calendar's standard inputs.
- No new npm dependencies (date-fns is already present).
- Out of scope: scroll-wheel time picker, range pickers, time pickers with seconds.

## Build order

1. Create `<DatePicker />` and `<TimePicker />` in `src/components/ui/`.
2. Wire into `log.tsx` (biggest surface).
3. Wire into `settings.tsx` (DOB).
4. Wire into `import.tsx` if it has a date field.
5. Smoke test: open Log, change date with arrows + calendar, set Bedtime/Wake, save — confirm values persist.
