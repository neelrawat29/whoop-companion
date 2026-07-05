## Goal
Make every screen of Whoop Companion usable on mobile (≥360px) while preserving the current desktop layout. The `AppShell` already handles nav (sidebar on desktop, header + bottom tabs on mobile), so this plan focuses on page-level content.

## Scope (pages to audit & fix)
- `/` Today (`index.tsx`)
- `/log`, `/meals`, `/supplements`, `/weight`
- `/insights` + `/insights/biological-age`
- `/chat` (thread list + `ChatWindow`)
- `/community` (list, group, settings, join)
- `/import`, `/settings`
- `/auth`, `/reset-password`, `/trust`

## Responsive patterns to apply
Following the project's responsive-layout rules:

1. **Header rows** with title + actions/widgets: switch from `flex justify-between` to
   `grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center sm:justify-between`, add `min-w-0` to the text side, `shrink-0` to icons/buttons, and `truncate` on headings. Scale headings `text-xl sm:text-2xl md:text-3xl`.

2. **Multi-column stat/card grids**: normalize to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4` (currently some use `md:grid-cols-*` with no base, causing cramped mobile).

3. **Tables** (log, supplements, meals, weight history, community members): wrap in `<div className="overflow-x-auto -mx-4 px-4">` and set `min-w-[640px]` on the table so mobile scrolls horizontally instead of clipping. For simple lists, swap to a stacked card layout under `sm:`.

4. **Forms / settings**: change fixed 2-col grids to `grid-cols-1 md:grid-cols-2`; make inputs `w-full`; stack action buttons full-width on mobile (`w-full sm:w-auto`).

5. **Chat window** (`ChatWindow.tsx` + `/chat` list): make the thread list a drawer/back-button flow on mobile — show list OR conversation based on route, not side-by-side. Message bubbles: `max-w-[85%] sm:max-w-[75%]`, input bar sticky above the mobile bottom tab bar (`pb-[env(safe-area-inset-bottom)]` + `bottom-14 md:bottom-0`).

6. **Charts** (insights, weight, biological-age): wrap Recharts in `ResponsiveContainer` with `min-h-[220px]` and remove fixed widths; reduce tick font-size on `<sm`.

7. **Dialogs / drawers**: ensure `max-w-[calc(100vw-2rem)]` and `max-h-[85vh] overflow-y-auto` so long forms scroll on small screens.

8. **AppShell main content**: change `max-w-5xl mx-auto px-4 py-6 pb-24 md:py-8 md:px-8` to keep `pb-24` only on mobile (bottom tabs) via `pb-24 md:pb-8`, and add `safe-area-inset` padding.

9. **Age dial / hero visuals** (`age-dial.tsx`, Today hero): use `w-full max-w-[280px] sm:max-w-[360px] aspect-square` instead of fixed pixel sizes.

10. **Save bar** (`save-bar.tsx`): make the action row wrap and full-width on mobile.

## Approach
- Audit each file in scope, identify the specific violations (fixed widths, missing base grid columns, unresponsive flex rows, non-scrollable tables, oversized text).
- Apply the patterns above with targeted `line_replace` edits — no logic or data changes.
- Verify with Playwright at 375×812 (iPhone), 768×1024 (tablet), and 1440×900 (desktop) by screenshotting each route while authenticated, and iterate on any overflow or clipping found.

## Out of scope
- No new features, no navigation restructuring beyond the chat list/detail split on mobile.
- No design-token or color changes.
- No backend or data-model changes.

## Deliverable
All routes render without horizontal page overflow, all primary actions reachable, all text legible on a 360px-wide viewport, and desktop layout unchanged at ≥1024px.
