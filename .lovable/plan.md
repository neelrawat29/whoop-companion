## Root cause of the sign-in bug

Two problems compound on the native SwiftUI app:

1. **Redirect URL mismatch inside the app.** `ios-native/WhoopCompanion/Config.swift` declares `oauthRedirectURL = cove://auth-callback`, but `AuthView.signInWithGoogle()` passes `redirectTo: cove://login-callback` and starts `ASWebAuthenticationSession` with `callbackURLScheme: "cove"`. Neither value is registered on the Supabase side, so...
2. **`cove://` is not in the backend's redirect allow-list.** When Supabase can't match the requested `redirect_to`, it silently falls back to the project's Site URL (`https://cove-companion.lovable.app`). Google's callback lands on the web app inside `ASWebAuthenticationSession`, the session finishes without hitting the `cove://` scheme, and the user sees the mobile web login. Exactly what you're describing.

## Fix (native app)

1. Standardize on **one** deep link: `cove://login-callback`.
   - `Config.swift`: change `oauthRedirectURL` to `URL(string: "cove://login-callback")!`.
   - `AuthView.swift`: use `Config.oauthRedirectURL` (and its `.scheme`) instead of hardcoded strings, so this can never drift again.
   - `Info.plist` already registers the `cove` scheme — no change needed.
2. Add `cove://login-callback` to the Supabase Auth **Additional Redirect URLs** allow-list via a config change. Without this, Supabase will keep rewriting the redirect back to the web Site URL and the bug returns.
3. Keep `WhoopCompanionApp.onOpenURL { url in try? await ...auth.session(from: url) }` as-is — it's already correct; it just never fired because the callback wasn't reaching the app.

## Remove Capacitor

Delete the unused Capacitor wrapper so nobody accidentally installs the WebView build again:

- Delete `capacitor.config.ts`.
- Delete `IOS_BUILD.md` (Capacitor-only doc).
- Remove `src/lib/push.ts` (Capacitor-only) and its `registerPushNotifications` call in `src/routes/_authenticated/route.tsx` (plus the import and the `useEffect` that invokes it).
- `bun remove @capacitor/core @capacitor/ios @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar @capacitor/assets @capacitor/cli`.
- Leave the "iOS safe-area utilities" CSS comment in `src/styles.css` unchanged — the padding rules are harmless for pure web and the mobile web still benefits.
- No `ios/` or `android/` folders exist in the repo, so nothing else to delete.

## Files touched

- `ios-native/WhoopCompanion/Config.swift` — fix redirect URL constant.
- `ios-native/WhoopCompanion/Auth/AuthView.swift` — use `Config.oauthRedirectURL` for both `redirectTo:` and `callbackURLScheme:`.
- `src/routes/_authenticated/route.tsx` — drop push registration.
- `src/lib/push.ts` — deleted.
- `capacitor.config.ts` — deleted.
- `IOS_BUILD.md` — deleted.
- `package.json` / `bun.lock` — Capacitor deps removed via `bun remove`.
- Supabase Auth config — add `cove://login-callback` to Additional Redirect URLs.

## Out of scope

- Apple Sign In flow (already token-based, unaffected).
- Web app auth (`/auth` route) — untouched.
- Any UI redesign.

## Verification

- Fresh install on a new iPhone → tap "Continue with Google" → in-app Safari sheet appears → pick Google account → sheet closes → app lands directly on the signed-in Home tab. The web app is never shown.
- Kill and relaunch the app → session persists (SupabaseManager restores the session, `SessionStore.bootstrap()` sets `.signedIn`).
- `bun run build` succeeds with no `@capacitor/*` imports remaining.
