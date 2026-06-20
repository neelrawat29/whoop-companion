Add a "Today" chip next to the DatePicker on every page that has a "Viewing date" control. When the user navigates to a past date, the chip appears; clicking it snaps the date back to today. When already on today, the chip is hidden.

### Pages to update
- `src/routes/_authenticated/log.tsx`
- `src/routes/_authenticated/supplements.tsx`
- `src/routes/_authenticated/meals.tsx`
- `src/routes/_authenticated/weight.tsx`

### Pattern
Each page already has a `DatePicker` inside a `flex flex-col items-end` wrapper with a `Label` above it. Replace that wrapper with a horizontal row (`flex items-center gap-2`) containing:
1. The existing `DatePicker`
2. A `Badge` / small pill button labelled "Today" that only renders when `date !== today()` and calls `setDate(today())` on click.

Use `Badge` from `@/components/ui/badge` (or a small `Button` with `variant="secondary" size="sm"` if `Badge` is not interactive enough). Style it as a compact pill that matches the app's minimal aesthetic.

No DB, server, or new dependencies needed.