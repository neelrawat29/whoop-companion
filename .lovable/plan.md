# Auth page redesign + standard auth features

## 1. Layout — split screen (desktop), stacked (mobile)

Rework `src/routes/auth.tsx` into a 2-column shell:

- **Left (desktop, `lg:flex` hidden on mobile)**: full-height background image with a soft dark gradient overlay, app logo top-left, and a short brand tagline bottom-left ("Your private daily recovery log" / quote-style copy).
- **Right (always visible)**: centered form column, max-width ~420px, white/card background, vertical center, generous padding. Hosts logo (mobile only), title, providers, divider, email form, footer links.
- Use semantic tokens only (`bg-background`, `bg-card`, `text-foreground`, `border-border`).

Generate a wellness/recovery hero image with `imagegen` (moody athletic recovery photography, dark muted blues/teals matching the primary token, 1280x1920 portrait, fast tier saved to `src/assets/auth-hero.jpg`).

## 2. Sign-in providers

Enable Apple and Microsoft via `supabase--configure_social_auth` (`providers: ["google","apple"]` — Microsoft isn't supported in the managed list, see note below).

> **Note on Microsoft**: Lovable Cloud managed social login only supports `google` and `apple`. I'll enable Apple now via the managed flow. For Microsoft I'll add a placeholder button that surfaces a toast explaining it requires connecting Supabase directly to configure the Azure provider — and ask if you want to skip Microsoft for now or wire it up via raw Supabase OAuth (`supabase.auth.signInWithOAuth("azure")`) which needs your Azure app credentials. **Recommended: ship with Google + Apple, drop Microsoft.** Confirm in the next turn if you want me to attempt the Azure path instead.

Provider buttons in the form (stacked, full width, outline variant, brand icon left):
- Continue with Google (existing)
- Continue with Apple (new — uses `lovable.auth.signInWithOAuth("apple", ...)`)

## 3. Forgot password — full flow

- Add "Forgot password?" link to the right of the Password label on sign-in mode.
- Click → switches the card into a `forgot` mode with email input + "Send reset link" button. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/reset-password })`. Shows success state ("Check your email").
- Create `src/routes/reset-password.tsx` (public, `ssr: false`):
  - Detects recovery session from URL hash (`type=recovery`).
  - Form: new password + confirm password (min 8, match check).
  - Calls `supabase.auth.updateUser({ password })`.
  - On success → toast + navigate to `/` (authenticated session is now active).
  - On no recovery token → friendly message + link back to `/auth`.

## 4. Other polish

- Larger headline `text-3xl font-semibold` on the right column.
- Show password toggle (eye icon) on password input.
- "Remember me" — **skipping** (Supabase already persists session via localStorage; adding a checkbox would be cosmetic only).
- Keep email/password mode toggle as a footer link.
- Update mobile: hide left column under `lg`, show logo at top of right column.

## Files

- **edit** `src/routes/auth.tsx` — split layout, Apple button, forgot-password mode, password visibility toggle
- **new** `src/routes/reset-password.tsx` — recovery page
- **new** `src/assets/auth-hero.jpg` — generated background image
- **tool calls**: `imagegen--generate_image`, `supabase--configure_social_auth` (add `apple`)

## Out of scope

- Microsoft sign-in (not supported by managed social login; see note above — confirm if you want the Azure raw-Supabase path instead)
- Magic-link / passwordless email
- 2FA
- "Remember me" checkbox (no behavioral effect on top of current session persistence)
