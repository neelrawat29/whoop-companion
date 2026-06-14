# Biological Age — Redesign Plan

## 1. Empty state: remove the button
In `src/routes/_authenticated/insights/biological-age.tsx`, the `!result.ready` branch currently renders an "Open Settings" button. Remove the `<Link to="/settings"><Button>Open Settings</Button></Link>` block entirely. Keep the card title, reason, and missing-inputs list so the user still understands why nothing is shown.

## 2. New hero: Animated Age Dial
Replace `HeroNumber` with a `AgeDial` component:

- A large circular SVG gauge (≈280px) centered in the card.
- Arc spans an age range derived from `chronological ± 10` (clamped sensibly).
- Two markers on the arc: a faint tick for chronological age, a glowing dot for biological age.
- On mount, the dot animates from the chronological tick → biological position over ~1.2s with `ease-out`, and the arc between them fills in (green if younger, rose if older, muted if ~equal).
- Center stack: the biological number animates by counting up/down (tween) to the final value, with `tabular-nums`, 72–80px. Below it, smaller "vs 34 chronological" and the existing delta pill.
- Soft radial glow behind the dial that picks up the delta color.
- Respect `prefers-reduced-motion`: skip the sweep, render final state.

Implementation notes:
- Pure SVG + CSS transitions (stroke-dasharray sweep for arc, transform rotate for the marker dot). No new dependencies.
- Number tween via a small `useEffect` with `requestAnimationFrame`.

## 3. Story scroll for the rest of the page
Wrap each section below the hero in a reveal wrapper that fades + slides up when it enters the viewport:

- Order: Hero → Trend (90 days) → Contribution by domain → Helping / Hurting → Confidence.
- Use `IntersectionObserver` in a tiny `<Reveal>` component (`src/components/reveal.tsx`) that toggles `animate-fade-in` (already in Tailwind config) with a small per-section delay.
- Add subtle section dividers (thin gradient line) between blocks so the scroll feels like chapters.
- Reduce visual noise: tighten card padding, use one consistent card radius, and let the hero card be borderless / gradient-tinted so it visually dominates.

## 4. Polish
- Add a one-line caption under the hero dial: "Younger by 3.2 years over the last 30 days" (dynamic from `delta`).
- Trend chart: switch the line to a soft gradient stroke matching delta color; thicken to 2.5px; add a subtle area fill at 8% opacity.
- Confidence: keep the bar but move it into a compact footer row (no card) so it doesn't compete with the hero.

## Technical
- Files touched:
  - `src/routes/_authenticated/insights.biological-age.tsx` — remove button, swap `HeroNumber` for `AgeDial`, wrap sections in `<Reveal>`.
  - `src/components/age-dial.tsx` (new) — SVG dial + count-up animation.
  - `src/components/reveal.tsx` (new) — IntersectionObserver fade/slide wrapper.
- No new packages, no backend changes. Existing `getBiologicalAge` / `getBiologicalAgeHistory` server functions already return everything needed (`biological`, `chronological`, `delta`, `confidence`, `domainTotals`, `modifiers`).
- Honors `prefers-reduced-motion` for accessibility.

```text
┌─────────────────────────────────┐
│        ╭───────────╮            │
│      ◜   ●dot       ◝           │   ← animated dial
│     ◜    32.8       ◝           │   ← count-up number
│      ◟  vs 36 chrono ◞          │
│        ╰───────────╯            │
│      [ 3.2 years younger ]      │
└─────────────────────────────────┘
        (scroll reveals)
   Trend ▸ Breakdown ▸ Help/Hurt ▸ Confidence
```
