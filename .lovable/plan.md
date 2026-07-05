Implement the selected **Emerald Prestige Refined** desktop theme for Whoop Companion while keeping the existing Arctic Frost mobile theme intact.

What will change
1. Desktop color tokens in `src/styles.css`
   - Warm ivory background `#FDFCF8` instead of the current yellow-tinged ivory.
   - Deep emerald primary `#064E3B` for text, buttons, and active states.
   - Muted gold accent `#C5A059` for highlights, active nav indicator, and metric callouts.
   - Stone-100 / warm neutral borders and cards instead of the current green-tinted borders.
   - Softer, more premium shadow values (smaller, warmer tints).

2. Desktop typography
   - Add `Playfair Display` for headings on the desktop theme only via the root route `<head>` link.
   - Keep `Manrope` / `Sora` for mobile (Arctic Frost) and for body text on desktop.
   - Apply Playfair via `data-theme="web" h1/h2` styling in `src/styles.css`.

3. Desktop sidebar refinement in `src/components/AppShell.tsx`
   - Active nav item: deep emerald background with gold text/icon or gold left accent bar.
   - Hover state: warm ivory tint, not a bright green tint.
   - Logo container and app title use the refined gold/emerald pairing.
   - Sign-out button gets a subtle secondary hover matching the new palette.

4. Card component polish
   - Slightly warmer `bg-card` and `border` values driven by the new tokens.
   - Keep the 28 px radius; update shadow to the new warm soft shadow token.

5. Verification
   - Preview at desktop width (>=1024px) to confirm the refined ivory/gold/emerald feel.
   - Preview at mobile width (<1024px) to confirm Arctic Frost blue theme is unchanged.

What will NOT change
- Mobile theme (Arctic Frost) colors, fonts, or component styles.
- Navigation structure, routes, or the "More" sheet behavior.
- Any data, auth, or backend logic.

Deliverable
A single build that updates the desktop web theme to Emerald Prestige Refined, with mobile untouched.