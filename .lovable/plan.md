## Right-aligned login card + new background options

### 1. Generate 2 new background images
- `src/assets/auth-bg-recovery.jpg` — athlete stretching/meditating post-workout, warm natural light, calm and aspirational (1536×1024)
- `src/assets/auth-bg-sunrise.jpg` — runner on a coastal trail at sunrise, golden hour, energetic (1536×1024)

Keep the existing `auth-hero.jpg` as a third fallback so nothing breaks mid-iteration.

### 2. Present the two new images for selection
After generating, show both options and let you pick which one becomes the live background. Only the chosen image is wired into `auth.tsx` and `reset-password.tsx`; the other is deleted.

### 3. Reposition the login card to the right edge
In `src/routes/auth.tsx` and `src/routes/reset-password.tsx`:
- Change the form wrapper from `items-center justify-center` to `items-center justify-end`.
- Add right padding so the card has ~80px breathing room from the edge: `pr-12 lg:pr-20` (mobile stays centered via `justify-center md:justify-end`).
- Keep card width `max-w-md`, all existing styling (white card, shadow, rounded), and all auth functionality unchanged.
- Mobile (`<md`): card stays centered so it doesn't get cramped.

### 4. Adjust the dark overlay
Switch the gradient to bias darkness toward the right side so the white card has stronger contrast: `bg-gradient-to-l from-black/70 via-black/40 to-black/20`.

No backend, auth, or routing logic changes.
