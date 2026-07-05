## Goal

Keep the current Arctic Frost soft-UI palette on phones and tablets, and apply a new **Emerald Prestige** theme (deep emerald + gold, ivory background) on desktop/web. Switch is driven by **device type** (touch/UA), not viewport width, so a tablet in landscape still gets the mobile theme and a small desktop window still gets the web theme.

## Palette — Emerald Prestige (web only)

- Background: `#f5f0e0` (warm ivory)
- Surface / cards: `#ffffff` with subtle emerald-tinted borders
- Primary: `#064e3b` (deep emerald)
- Primary hover / secondary: `#0d7a5f`
- Accent (highlights, active tab, edit links): `#c9a84c` (gold)
- Foreground text: near-black emerald `#0b2a22`
- Muted text: `#5c7269`

Typography stays Sora + Manrope. Radius stays at 1.5rem so cards keep their soft iOS-ish feel — the web theme just changes color, not shape/spacing.

## Switch mechanism (by device type)

1. Add a tiny theme helper that runs before hydration (in `src/routes/__root.tsx` shell or a small inline script) that sets `data-theme="web"` or `data-theme="mobile"` on `<html>`.
2. Detection rule: `data-theme = (matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) ? 'mobile' : 'web'`.
3. Re-evaluate on `resize` + `pointerchange` so plugging in a mouse on a 2-in-1 flips it.
4. SSR default = `mobile` (safest for perceived-first-paint on phones); client script corrects it on mount with no flash because both themes share the same background lightness range.

## CSS wiring (`src/styles.css`)

- Keep the existing `:root { ... }` block as the **mobile / default** Arctic Frost tokens.
- Add a sibling `:root[data-theme="web"] { ... }` block that overrides only the color tokens (`--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--input`, `--ring`) with Emerald Prestige oklch values.
- Leave `--radius`, fonts, shadows shared.
- Update `Card` component's hardcoded shadow color to a token (`var(--shadow-soft)`) so it tints correctly under each theme.

## Component touch-ups

- `AppShell` desktop sidebar: on web theme, active-nav pill uses gold accent (`bg-accent text-accent-foreground`) instead of solid primary, matching the editorial feel.
- `AppShell` mobile pieces (frosted top bar, floating pill tab bar): unchanged — they only render at md and below, so the mobile theme drives them.
- Meta `theme-color` in `__root.tsx` head switches with a small client effect to reflect the active theme in browser chrome.

## Files to change

```text
src/styles.css                — add [data-theme="web"] token overrides + shadow tokens
src/routes/__root.tsx         — inline theme-detect script in shell, dynamic theme-color
src/components/AppShell.tsx   — small variant tweak for desktop active nav item
src/components/ui/card.tsx    — swap hardcoded shadow for token
```

No route, data, or backend changes. No new dependencies.

## Verification

Playwright at three viewports:
- 390×844 mobile UA → Arctic Frost
- 820×1180 iPad UA → Arctic Frost
- 1440×900 desktop (mouse/pointer:fine) → Emerald Prestige

Confirm background, primary buttons, active nav, and card borders reflect the right theme on each.
