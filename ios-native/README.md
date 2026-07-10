# Whoop Companion — Native iOS

A thin native SwiftUI shell around a `WKWebView` that loads the published
mobile web app (`https://cove-companion.lovable.app`). Every screen and
feature is the exact mobile web experience, so anything shipped on the web
immediately appears in the iOS app with no rebuild.

## One-time setup on your Mac

1. Install Xcode 15+ from the App Store.
2. Install [Homebrew](https://brew.sh) if you don't have it.
3. Install XcodeGen: `brew install xcodegen`

## Generate & open the project

From this `ios-native/` folder on your Mac:

```bash
xcodegen generate
open WhoopCompanion.xcodeproj
```

Re-run `xcodegen generate` any time you pull changes that add/remove Swift files.

## First build

1. Select the **WhoopCompanion** scheme and a device (your iPhone or a simulator).
2. **Signing & Capabilities** → pick your Apple ID team.
3. Press ▶ Run. The app launches straight into the web app; sign in with
   Apple / Google / email inside the web UI. The session persists across
   launches via `WKWebsiteDataStore`.

## Project layout

```
WhoopCompanion/
├── WhoopCompanionApp.swift    # @main — hosts WebAppView
├── Web/WebAppView.swift       # WKWebView wrapper
├── Shared/Theme.swift         # colors used by launch screen
└── Assets.xcassets            # app icon + launch colors
```
