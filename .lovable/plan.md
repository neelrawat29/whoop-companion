## Problem

Theme detection currently checks `pointer: coarse` and the User-Agent string once at page load. In the Lovable preview, switching to the mobile/tablet device only resizes the iframe — the UA and pointer type stay "desktop", so `data-theme` stays `web` and Arctic Frost never appears.

## Fix

Switch the detection to **viewport width**, which is what actually distinguishes phone/tablet from desktop in both the preview and real deployments.

- Breakpoint: `< 1024px` → `data-theme="mobile"` (Arctic Frost). `≥ 1024px` → `data-theme="web"` (Emerald Prestige). 1024px aligns with Tailwind's `lg` — phones (≤ ~430) and all iPads in portrait (768) and landscape (1024 edge) fall into mobile; laptops/desktops get web.
- Keep the inline pre-hydration script in `src/routes/__root.tsx`, but replace the pointer/UA logic with `window.innerWidth < 1024`.
- Re-evaluate on `resize` (already wired) so dragging the preview device switcher flips the theme instantly.
- Also update the `theme-color` meta tag on switch (already wired) so browser chrome tint follows.

## Files to change

```text
src/routes/__root.tsx  — replace THEME_DETECT_SCRIPT logic with viewport-width check
```

No other file needs to change. Tokens, palettes, and component styling stay exactly as-is.

## Verification

Playwright at three viewports on the same UA:
- 390 × 844 → `data-theme="mobile"`, blue Arctic Frost
- 820 × 1180 → `data-theme="mobile"`, blue Arctic Frost
- 1440 × 900 → `data-theme="web"`, emerald + gold

Then live-toggle in the preview (mobile → tablet → desktop) and confirm the theme swaps without a reload.
