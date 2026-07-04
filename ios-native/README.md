# Whoop Companion — Native iOS

A real SwiftUI app (no WebView, no Capacitor) that talks to the same Lovable Cloud backend as the web app.

## One-time setup on your Mac

1. Install Xcode 15+ from the App Store.
2. Install [Homebrew](https://brew.sh) if you don't have it.
3. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```

## Generate & open the project

From this `ios-native/` folder on your Mac:

```bash
xcodegen generate
open WhoopCompanion.xcodeproj
```

XcodeGen reads `project.yml` and produces a real `.xcodeproj`. Re-run `xcodegen generate` any time you add/remove Swift files.

## First build

1. In Xcode, wait for Swift Package Manager to resolve `supabase-swift` (declared in `project.yml`).
2. Select the **WhoopCompanion** scheme and a device (your iPhone or a simulator).
3. **Signing & Capabilities** → pick your Apple ID team. If you don't have one, add your Apple ID under Xcode → Settings → Accounts.
4. Press ▶ Run.

### Free Apple ID limits
- App expires after **7 days** — re-run from Xcode to reinstall.
- Max 3 sideloaded apps at a time.
- No push notifications.

### Paid Apple Developer ($99/yr)
- 1-year signing.
- Push notifications work.
- Can produce a `.ipa` for AltStore / Sideloadly distribution.

## Configuration

`WhoopCompanion/Config.swift` holds the Supabase URL, publishable key, and API base. They're already filled in for this project.

## Project layout

```
WhoopCompanion/
├── WhoopCompanionApp.swift    # @main
├── Config.swift
├── Supabase/                  # client + Codable models
├── Auth/                      # sign in / sign up
├── Shared/                    # theme, tab shell, reusable UI
└── Features/
    ├── Log/
    ├── Weight/
    ├── Insights/
    ├── Meals/
    ├── Supplements/
    ├── Community/
    └── Chat/                  # SSE client for /api/chat
```

## First-run fixes

Because these files were scaffolded on Linux with no Swift compiler, expect a small round of Xcode errors on first build (missing imports, minor type mismatches). Paste them back into Lovable chat and I'll fix them.
