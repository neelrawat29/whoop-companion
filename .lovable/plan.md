# Mobile navigation: 4 tabs + "More" sheet

## The problem
Desktop sidebar shows all 10 destinations. The mobile bottom bar currently tries to show all of them, which either overflows or crushes the labels. Native apps solve this the same way: keep the bottom bar to the few highest‑frequency destinations, and put the rest one tap away behind a "More" entry.

## Recommendation
Bottom bar shows **4 primary tabs + a 5th "More" tab**. Tapping More opens a bottom sheet with every remaining destination. This is the pattern used by Instagram, Gmail, LinkedIn, and the iOS/Material guidelines — it keeps thumb reach, avoids tiny 5+ item bars, and scales as we add pages later without another redesign.

### Primary 4 (bottom bar)
Chosen for daily‑use frequency in a health/coach app:

1. Today (`/`)
2. Log (`/log`)
3. Coach (`/chat`)
4. Insights (`/insights`)
5. **More** (opens sheet)

### In the More sheet
Supplements, Meals, Weight, Community, Import, Settings, plus Sign out at the bottom. Grid of large tap targets (icon + label), grouped loosely: Tracking (Supplements, Meals, Weight), Social (Community), System (Import, Settings, Sign out). The active route, if it lives in the sheet, gets the accent highlight in the bar's More tab so users know where they are.

### Behavior details
- Bottom bar stays exactly as today visually (Arctic Frost pills, floating style) — only the item set changes.
- Sheet uses the existing shadcn `Sheet` (side="bottom") so it matches theme tokens and closes on backdrop tap / route change.
- Desktop sidebar is unchanged — it already shows all 10.
- Tablet (< 1024px) follows the mobile pattern since it already shares the mobile theme.

## Alternatives considered (not recommended)
- **Horizontal scrolling bar** — hides destinations off‑screen, discoverability is poor, and it fights the OS gesture area.
- **Hamburger drawer as the only nav** — hides the 4 most‑used pages behind an extra tap; regression vs. today.
- **Two rows of tabs** — eats vertical space and looks unbalanced on small phones.

## Technical scope
Single file: `src/components/AppShell.tsx`.

- Split `nav` into `primaryNav` (4 items) and `moreNav` (the rest).
- Bottom bar renders `primaryNav` + a `More` button (`MoreHorizontal` icon) that toggles a `Sheet` from `@/components/ui/sheet`.
- Sheet content: grid of `Link`s styled like the current sidebar rows, plus the Sign out button moved in from the sidebar footer for mobile only.
- Active detection: if `pathname` matches any `moreNav` item, mark the More tab active.
- No token, theme, or route changes.

## Verification
Playwright at 390×844 and 820×1180: bottom bar shows 5 slots, tapping More opens the sheet, every destination is reachable, active states light up correctly, and desktop (1440) is unchanged.
