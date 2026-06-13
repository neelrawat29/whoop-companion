## Full-screen background auth pages

Replace the split-screen layout on both auth pages with a full-bleed background image and a floating white form card.

### 1. `src/routes/auth.tsx`
- Remove the `lg:grid-cols-2` split layout.
- Make the `<img>` fill the entire viewport (`absolute inset-0 object-cover`).
- Add a dark overlay (`bg-black/40` or gradient) so the white card pops.
- Center the form column vertically and horizontally in a white rounded card (`bg-card`, `shadow-2xl`, `rounded-2xl`, `border`).
- Keep all existing functionality: Google/Apple SSO, email sign-in/sign-up, forgot-password flow, password visibility toggle, mode switching, and footer links.
- Add a subtle app logo watermark in the top-left corner of the background for branding.

### 2. `src/routes/reset-password.tsx`
- Apply the same full-screen background image + dark overlay.
- Center the existing `<Card>` on top of the image.
- Keep all existing reset-password logic unchanged.

### 3. Visual polish
- Use `shadow-2xl` or `shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]` on the white card for depth.
- Add `backdrop-blur-sm` on the overlay if desired for a modern frosted look.
- Ensure the card has generous padding (`p-8` or `p-10`) and a max-width (`max-w-md` or `max-w-sm`).
- Mobile: card remains centered with comfortable side margins (`px-6`).