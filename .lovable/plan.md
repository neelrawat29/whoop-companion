## Add Apple + Google sign-in to the iOS app

Currently `AuthView.swift` only offers email/password. The Sign in with Apple entitlement and the `whoopcompanion://` URL scheme are already configured, and `onOpenURL` already forwards callback URLs to Supabase — so the plumbing is mostly in place.

### Changes

1. **`AuthView.swift`** — add two buttons above the email form:
   - **Sign in with Apple** using the native `SignInWithAppleButton` (AuthenticationServices). On success, take the returned `identityToken` + `nonce` and call `SupabaseManager.shared.client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: token, nonce: rawNonce))`. Generate a random nonce and pass its SHA256 to Apple, raw nonce to Supabase (standard pattern).
   - **Continue with Google** button that calls `SupabaseManager.shared.client.auth.signInWithOAuth(provider: .google, redirectTo: URL(string: "whoopcompanion://login-callback"))` using supabase-swift's `WebAuthenticationSession` launcher (uses `ASWebAuthenticationSession` under the hood). The existing `onOpenURL` handler in `WhoopCompanionApp` already completes the session exchange.
   - Add a subtle "or" divider between the social buttons and the email form, matching the existing dark theme (`Theme.accent`, rounded, full-width).

2. **`Auth/AppleSignInHelper.swift`** (new) — small helper with `randomNonceString()` and `sha256()` utilities so `AuthView` stays readable.

3. **Supabase redirect allowlist** — add `whoopcompanion://login-callback` to the project's allowed redirect URLs so the Google OAuth callback is accepted. (Done via backend config, not code.)

### Out of scope

- No changes to the web auth flow.
- No changes to `SupabaseManager`, `SessionStore`, or the URL-scheme wiring — they already handle the callback.
- Google provider is already enabled in the backend (used by the web app); no provider re-config needed.

### Notes

- Sign in with Apple on iOS is fully native (no browser), which is required by App Store guidelines whenever another social login is offered — Google will use `ASWebAuthenticationSession`.
- The Apple flow uses Supabase's `signInWithIdToken`, so no redirect URL is needed for Apple.
