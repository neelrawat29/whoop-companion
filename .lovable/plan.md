Rebrand the iOS app from “Whoop Companion” to “Cove” with a minimal, premium app icon.

## What we’re building
- New iOS app display name: **Cove**
- New iOS AppIcon: a centered solid dot with 3–4 thin radiating rings/waves, on a neutral off-white/cream background, minimal and calm.
- Update the iOS deep-link URL scheme from `whoopcompanion` to `cove` so OAuth and universal links stay consistent with the new name.

## Files to change
1. **Generate new AppIcon**
   - 1024×1024 PNG, centered dot + radiating waves, neutral palette (soft cream/off-white background, deep charcoal or soft black glyph).
   - Replace `ios-native/WhoopCompanion/Assets.xcassets/AppIcon.appiconset/AppIcon.png`.

2. **Update app display name**
   - `ios-native/project.yml`: change `CFBundleDisplayName` from `Whoop Companion` to `Cove`.

3. **Update deep-link / OAuth scheme**
   - `ios-native/WhoopCompanion/Info.plist`: change `CFBundleURLSchemes` from `whoopcompanion` to `cove` and `CFBundleURLName` to `app.lovable.cove`.
   - `ios-native/WhoopCompanion/Config.swift`: update `oauthRedirectURL` from `whoopcompanion://auth-callback` to `cove://auth-callback`.

4. **Regenerate Xcode project**
   - Run `xcodegen generate` inside `ios-native/` so the new asset, display name, and plist changes are reflected in the `.xcodeproj`.

## Out of scope (unless you say otherwise)
- Web app title/meta: will stay as “Whoop Companion” per your iOS-only scope.
- Product bundle identifier (`app.lovable.whoopcompanion`): keeping it avoids App Store provisioning disruption, but let me know if you want it renamed to `app.lovable.cove`.
- Tests target name and folder names: leaving as-is for now to avoid breaking references.

## Deliverable
A rebuildable iOS project that shows the “Cove” name and the new radiating-dot icon on the home screen and in Settings.