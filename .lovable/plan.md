# Plan: Visual Rhythm + Navigation Upgrade

Implementing improvements #6 (visual rhythm) and #9 (navigation) from the prior list.

## 1. Navigation — sidebar on desktop, bottom tabs on mobile

Rework `src/components/AppShell.tsx`:

- **Mobile (< md)**: keep the existing fixed bottom tab bar (Today, Log, Meals, Insights, Settings). Keep the slim top header with logo + sign-out.
- **Desktop (md+)**: replace the horizontal top nav with a **fixed left sidebar** (~240px):
  - Logo + app name at top
  - Full nav list as vertical items with icon + label (Today, Log, Supplements, Meals, Insights, Import, Settings)
  - Active item: subtle accent background + primary text + left accent bar
  - Hover: muted background
  - Sign-out button pinned to the bottom of the sidebar
  - Main content area gets `md:pl-60` and the top header is hidden on desktop
- Use semantic tokens only (`bg-card`, `bg-accent`, `text-primary`, `border-border`, `text-muted-foreground`).

## 2. Visual rhythm — Today page polish

Edit `src/routes/_authenticated/index.tsx` for tighter, more confident hierarchy:

- **Spacing scale**: bump section gap from `space-y-6` → `space-y-8`; card internal padding stays but use consistent `gap-y-6` between header/content.
- **Header block**: keep date as h1, but reduce subtitle weight; add a thin `border-b border-border/50 pb-4` divider under the page header for a clearer "top of page" rhythm.
- **Recommendation card** (hero): remove the `border-2` toggle and instead use a soft `bg-gradient-to-br from-card to-accent/30` plus `shadow-sm` so it reads as the hero without a heavy outline. Increase the rec title to `text-4xl` and tighten leading.
- **Metric row**: add subtle vertical dividers between the 4 metrics on desktop (`md:divide-x md:divide-border/60`) with `md:px-4` per cell, so the row feels like a single instrument panel rather than 4 floating numbers. Numbers go to `text-3xl font-semibold tabular-nums`. Labels use uppercase `text-[11px] tracking-wider`.
- **Secondary cards (Habits / Supplements / Meals)**:
  - Standardize card headers: icon in a small rounded square `size-8 rounded-md bg-accent grid place-items-center` with `size-4` icon inside (consistent icon weight across the page).
  - Replace the `border-b border-border` row dividers in Meals with `divide-y divide-border/60` on the list wrapper for cleaner rhythm.
  - Habits Grid2: increase `gap-y-3` → `gap-y-4` and add `text-[11px] uppercase tracking-wider` on stat labels for consistency with the hero.
  - Note line: use `border-t border-border/60 pt-3 mt-1` for the divider rhythm.
- **Edit links**: standardize to a small pill `text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-accent` with the pencil icon — quieter, more refined than current bare link.
- **Empty states**: keep text-only for now (empty-state CTAs were item #3, out of scope here).

## Out of scope
Items 1 (recovery ring), 2 (sparklines), 3 (empty-state CTAs), 4, 5, 7, 8, 10 — separate follow-ups.

## Files changed
- `src/components/AppShell.tsx` — sidebar + bottom tab layout
- `src/routes/_authenticated/index.tsx` — spacing, dividers, header standardization, icon chips
