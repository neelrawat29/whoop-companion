# Log page — Save button feedback

## Current behavior
- Click Save → button shows "Saving..." → a toast appears bottom-right → button returns to "Save morning" / "Save evening".
- Values already stay in the inputs (they're driven by the saved entry), but nothing on the form itself signals success. The toast is easy to miss, especially on mobile.

## What I'll change

### 1. Keep values, gray out the button after save (your ask)
Track a "dirty" flag per card. The Save button is **disabled and labeled "Saved ✓"** when:
- A save just succeeded, AND
- No field has been edited since.

As soon as the user edits any field, the button re-enables and the label flips back to "Save morning" / "Save evening". On initial load of an already-saved day, the button also starts in the "Saved ✓" state (no edits yet vs. stored data).

Implementation: compute `isDirty` by comparing current form state to the loaded `entry` / `habits` row. `disabled = save.isPending || !isDirty`. Label = `isPending ? "Saving…" : isDirty ? "Save morning" : "Saved ✓"`. Uses a subtle check icon and the muted/secondary button variant when saved.

### 2. Additional feedback improvements (suggestions — tell me which to include)

A. **"Last saved" timestamp** under the card title, e.g. "Saved 2 min ago". Updates live, reads `updated_at` from the row.

B. **Brief green flash** on the card border (300ms) right after save succeeds — peripheral confirmation without needing to read a toast.

C. **Per-field saved indicator**: small check icon inside each input that just got persisted, fades after ~2s. More granular but more visual noise — probably overkill here.

D. **Inline status line** next to the Save button: "All changes saved" (muted) vs. "Unsaved changes" (amber) — mirrors Google Docs / Notion. Pairs well with A.

E. **Haptic + sound on mobile** (`navigator.vibrate(15)`) on success. Tiny touch, very satisfying as an installed PWA.

F. **Auto-save on blur / debounced** — removes the Save button entirely for the evening card. Bigger change; only worth it if you want to commit to it.

My recommendation: **1 + A + B + D** (and E if you want the PWA feel). That gives obvious, glanceable confirmation without restructuring the form.

## Files touched
- `src/routes/_authenticated/log.tsx` — `MorningCard` and `EveningCard`: add `isDirty` derivation, update button `disabled` / label / variant, optionally add the "Last saved" line, border-flash effect, and status text.

No backend, schema, or other route changes.

## Open question
Which of A–F should I include alongside the grayed-out Save button? Default if you don't specify: **A + B + D**.
