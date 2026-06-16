# Add Phone OTP Login

Add phone number + SMS one-time-code as a fourth login method, alongside Google, Apple, and email/password. The UI ships and works end-to-end except OTP delivery, which is dark until an SMS provider is connected.

## How it works

```text
1. User enters phone number  →  supabase.auth.signInWithOtp({ phone })
2. Backend triggers SMS send  →  6-digit code arrives on the phone
3. User enters the 6 digits   →  supabase.auth.verifyOtp({ phone, token, type: 'sms' })
4. Session created, profile.phone backfilled, redirect to app
```

No password, no email needed for phone users. Same `auth.users` record either way — `auth_method` is just metadata.

## Changes I'll make

### 1. Database (migration)
- Add `phone TEXT` column to `public.profiles`.
- Add a trigger on `profiles` (or extend `handle_new_user`) so that when an `auth.users` row has `phone` set, it's mirrored to `profiles.phone` automatically — both on signup and on subsequent phone updates.
- Add an index on `profiles.phone` for future lookup (e.g. "find friend by number").
- RLS unchanged — `profiles` policies already scope to `auth.uid()`.

### 2. Auth UI (`src/routes/auth.tsx`)
- Add a "Phone" tab next to the existing tabs, with two sub-steps:
  - **Step 1 — Enter phone**: country-code dropdown (default to user's locale, fallback `+1`) + national number input. Format to E.164 client-side before sending. Submit → `supabase.auth.signInWithOtp({ phone })`.
  - **Step 2 — Enter code**: 6-digit OTP input (auto-advancing single-digit cells), resend button with 30s cooldown, "wrong number?" back link. Submit → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
- Validation with `zod`: E.164 regex `/^\+[1-9]\d{6,14}$/`, OTP `\d{6}`.
- Loading + error states (`toast.error` for invalid OTP, expired code, rate-limited).
- On success: `onAuthStateChange` already redirects via the root listener.

### 3. Profile mirror
- The DB trigger handles new signups. For existing users who later add a phone via /settings (future work), the same trigger fires.
- If you ever want to **link** a phone to an already-signed-in Google/Apple/email user, that's a separate "Add phone to account" flow — flagged for later, not in this turn.

### 4. Backend config
- Call `supabase--configure_auth` to confirm phone provider is enabled at the project level.
- Document in the plan that **OTPs will not actually deliver** until an SMS provider is wired (Twilio is the standard path). The UI handles the "code didn't arrive" case gracefully — user sees a clear "SMS delivery isn't configured yet" toast instead of a silent failure.

## Out of scope (separate turns)

- Connecting Twilio / MessageBird / Vonage — you chose "decide later". When ready, that's a 5-minute follow-up: connect Twilio via the Lovable connector, paste the Twilio credentials into Lovable Cloud's Phone auth settings, done.
- "Add phone number to existing account" from `/settings`.
- Phone-based friend lookup / invites.
- WhatsApp OTP (alternative to SMS, cheaper internationally) — possible later via Twilio's WhatsApp Business channel.

## Risks / things to flag

- **Cost**: SMS is per-message (~$0.008 US, much more in some countries). Recommend enabling Supabase's per-IP/per-phone rate limits and Twilio's SMS Pumping Protection + Geo Permissions when you wire the provider — phone OTP is the #1 fraud target for cost attacks.
- **Phone collision**: if a user signs up with Google using `foo@gmail.com` and later signs in with phone `+15551234567`, those are **separate accounts** in Supabase unless explicitly linked. Account linking is a future enhancement; for now the UX is "your phone login is your phone login."
- **Until SMS provider is connected**: the Phone tab will appear, accept input, and show a clean error on submit. If you'd rather hide the tab entirely until SMS is live, say so and I'll gate it behind an env flag.
