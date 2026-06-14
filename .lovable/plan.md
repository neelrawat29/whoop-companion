# Fix: auth flicker loop

## What's happening

Console shows repeated `TypeError: Load failed` (network requests being blocked/failing in the preview). The route guard in `src/routes/_authenticated/route.tsx` calls `supabase.auth.getUser()`, which is a **network** call to the auth server. When that network call fails, it returns `{ error }`, the guard treats it as "not logged in" and redirects to `/auth`.

On `/auth`, the `useEffect` calls `supabase.auth.getSession()` — this is a **local** call that reads the session from `localStorage`. It finds the saved session and navigates back to `/`. The guard runs again, the network call fails again, redirect to `/auth` again → infinite flicker.

So the root cause is: the guard uses a network call that can fail transiently, while the auth page uses a local call that always succeeds. The two disagree and bounce the user.

## Fix

1. **`src/routes/_authenticated/route.tsx`** — replace `supabase.auth.getUser()` with `supabase.auth.getSession()`. The session is the source of truth for "is the user logged in right now"; `getUser()` is for revalidating the user record against the server. Only redirect to `/auth` when there is no session — not when a network request errors.

2. **`src/routes/auth.tsx`** — keep the existing `getSession()` check, so both sides agree.

That single change breaks the loop. No other files need to change.

## Why not "fix the network error"

The `Load failed` errors come from the sandboxed preview environment blocking some requests (typical in Safari + iframe previews). It is not something we can fix in app code, and the app should be resilient to a transient auth-server hiccup anyway — losing the network shouldn't sign the user out.
