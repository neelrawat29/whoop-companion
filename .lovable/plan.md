## Problem

The native iOS `AuthView` has only email/password — there are no Google or Apple buttons. Those buttons only exist on the web (`src/routes/auth.tsx`). The web flow uses `lovable.auth.signInWithOAuth`, which is browser-only and won't work in a native iOS app. Native iOS needs its own OAuth flow using the Supabase Swift SDK + Apple's system APIs.

## Plan

### 1. Info.plist — already has the deep link scheme
`whoopcompanion://` is registered. Good, no change needed there.

### 2. Enable "Sign in with Apple" capability in Xcode project
Add the `com.apple.developer.applesignin` entitlement to `ios-native/WhoopCompanion/WhoopCompanion.entitlements` (create if missing) and reference it in `project.yml`. This is required by Apple to use `ASAuthorizationAppleIDProvider` — without it the Apple sign-in sheet returns error 1000.

### 3. Add Google + Apple buttons to `AuthView.swift`
Native SwiftUI buttons matching the app's dark theme, shown above the email form with an "or" divider.

### 4. Implement Apple Sign-In natively
Use `ASAuthorizationAppleIDProvider` + `ASAuthorizationController` to get an Apple ID token, then call:
```swift
try await SupabaseManager.shared.client.auth.signInWithIdToken(
    credentials: .init(provider: .apple, idToken: idTokenString, nonce: rawNonce)
)
```
Generate a random nonce, pass its SHA256 to Apple, and pass the raw nonce to Supabase. This is the Apple-recommended native path — no web redirect, no Safari popup, no callback URL.

### 5. Implement Google Sign-In via ASWebAuthenticationSession
The Supabase Swift SDK has built-in support:
```swift
try await SupabaseManager.shared.client.auth.signInWithOAuth(
    provider: .google,
    redirectTo: Config.oauthRedirectURL   // whoopcompanion://auth-callback
)
```
The SDK opens `ASWebAuthenticationSession`, the user signs in with Google, Supabase redirects back to `whoopcompanion://auth-callback`, and the SDK completes the session automatically.

### 6. Register the redirect URL in the backend
Add `whoopcompanion://auth-callback` to the Auth redirect allow-list so Supabase accepts it as a valid post-OAuth redirect target. (Done via `supabase--configure_auth` / backend, no code change beyond that.)

### 7. Handle the callback URL in `WhoopCompanionApp.swift`
Add `.onOpenURL { url in Task { try? await SupabaseManager.shared.client.auth.session(from: url) } }` on the root scene so the deep-link resumes the session if the SDK doesn't auto-consume it.

## Files changed

- `ios-native/WhoopCompanion/Auth/AuthView.swift` — add buttons + Apple/Google handlers (nonce helper, ASAuthorizationController delegate wrapper).
- `ios-native/WhoopCompanion/WhoopCompanionApp.swift` — add `.onOpenURL` handler.
- `ios-native/WhoopCompanion/WhoopCompanion.entitlements` — new file with Sign in with Apple entitlement.
- `ios-native/project.yml` — reference the entitlements file and add the `AuthenticationServices` framework link if needed.

## Manual step you'll need to do once

In the Apple Developer portal, enable **Sign In with Apple** for the app's bundle ID (`app.lovable.whoopcompanion`). Xcode's automatic signing does most of this when the entitlement is present and you're signed into your Apple Dev account. Google needs no extra Apple-side setup — it flows through the existing managed Supabase Google provider.

## Technical notes

- The Supabase Swift SDK's `signInWithOAuth(provider:redirectTo:)` internally uses `ASWebAuthenticationSession`, so the user sees the standard system sheet and no external Safari tab.
- Apple's native path (`signInWithIdToken`) is preferred over the OAuth redirect path for Apple, because App Store review requires "Sign in with Apple" to use the native sheet when other social logins are offered.
- Nonce: generate 32 random bytes → base64url → SHA256 for Apple's `request.nonce`, keep the raw string for Supabase.