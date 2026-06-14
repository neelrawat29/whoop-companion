The `DatePicker` trigger label currently formats dates as `"EEE, MMM d"` (e.g., "Mon, Jan 15") which omits the year. For the Date of Birth field this is poor UX because the user cannot see what year they selected.

## Fix
1. **Add a `showYear` prop to `DatePicker`** (`src/components/ui/date-picker.tsx`).
   - When `showYear` is true, use `format(date, "MMM d, yyyy")` in the label.
   - Keep the existing short format as the default so log-page daily pickers are unchanged.
2. **Enable `showYear` on the DOB field** in `src/routes/_authenticated/settings.tsx`.

No other pages or components are affected.