## Goal

Replace the SwiftUI feature screens in `ios-native/` with a single full-screen `WKWebView` that loads the published mobile web app (`https://whoop-companion.lovable.app`). This gives 1:1 parity with the mobile web view forever — every future web change ships to iOS with no native rebuild.

Keep the native Xcode project, entitlements, launch/splash, and app icon so the app still installs and boots as a real iOS app.

## Changes

### New files
- `ios-native/WhoopCompanion/Web/WebAppView.swift` — SwiftUI `UIViewRepresentable` wrapping `WKWebView`:
  - Loads `https://whoop-companion.lovable.app`.
  - `WKWebViewConfiguration` with persistent `WKWebsiteDataStore.default()` so login sessions survive relaunch.
  - `allowsBackForwardNavigationGestures = true`.
  - `WKNavigationDelegate` that opens non-app-host links (Google/Apple OAuth popups, external links) via `UIApplication.open` when appropriate, and keeps in-app navigation inside the webview.
  - `WKUIDelegate` to handle `window.open` (OAuth popups) by loading in the same webview.
  - Pull-to-refresh via `UIRefreshControl` on the scroll view.
  - Safe-area respected (no `ignoresSafeArea` on top; bottom edge extends for full-bleed).

### Replaced files
- `ios-native/WhoopCompanion/WhoopCompanionApp.swift` — `RootView` becomes just `WebAppView()`. Remove `SessionStore` bootstrap and `onOpenURL` Supabase handling (web app owns auth now).
- `ios-native/WhoopCompanion/Shared/TabRoot.swift` — deleted (web app provides its own nav).

### Deleted files (native features no longer needed)
- `ios-native/WhoopCompanion/Auth/` (AuthView, AppleSignInHelper)
- `ios-native/WhoopCompanion/Features/` (Log, Weight, Insights, Meals, Supplements, Community, Chat, BiologicalAge)
- `ios-native/WhoopCompanion/Supabase/` (SupabaseManager, SessionStore, APIClient, Models)
- `ios-native/WhoopCompanion/Config.swift`

### Kept as-is
- `Info.plist`, `WhoopCompanion.entitlements`, `Assets.xcassets` (icon, splash colors), `Shared/Theme.swift` (if referenced by splash), `project.yml`.

### Config updates
- `ios-native/project.yml` — drop the Supabase Swift SPM dependency (no longer imported); keep only what `WebAppView` needs (WebKit is a system framework, no package needed).
- `ios-native/README.md` and `IOS_BUILD.md` — short note that the app is now a WebView shell; after pulling, run `xcodegen generate` in `ios-native/` then build.

## Auth behavior

The user signs in with Apple/Google/email inside the web app exactly like Mobile Safari. `WKWebView` persists cookies + `localStorage` (Supabase session) across launches via the default data store, so users stay signed in.

## Out of scope

- The existing Capacitor config (`capacitor.config.ts`) is untouched — the user chose the SwiftUI-with-WebView path, not Capacitor.
- Push notifications, deep links, and native share sheets are not wired in this pass (can add later if requested).

## Rebuild steps for the user

1. `cd ios-native && xcodegen generate`
2. Open `WhoopCompanion.xcodeproj` in Xcode and build.
