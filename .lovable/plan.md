## Fix Google and Apple login button icons

Replace the basic SVG icons in `src/routes/auth.tsx` with accurate, recognizable Google "G" and Apple logos.

### 1. GoogleIcon
- Use the official multi-color "G" logo: blue top, red top-right, yellow bottom-right, green bottom, blue top-left arc.
- Keep the current `size-4` usage and `className` prop.

### 2. AppleIcon
- Use the official Apple logo (the bitten apple silhouette with leaf).
- Keep `fill="currentColor"` so it inherits button text color.
- Keep the current `size-4` usage and `className` prop.

No other UI, layout, or auth logic changes.
