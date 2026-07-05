Finish the iOS app icon for the Whoop Companion native app.

## Current state
- The user selected the **Precision Monogram Icon** direction: a dark (#0A0C0D) square icon with a cyan open ring (#1A8CFA), a white stylized "W" mark, and a cyan accent dot.
- A 1024×1024 PNG has already been generated and saved to `ios-native/WhoopCompanion/Assets.xcassets/AppIcon.appiconset/AppIcon.png`.

## Remaining work
1. Update `ios-native/WhoopCompanion/Assets.xcassets/AppIcon.appiconset/Contents.json` to reference the new file:
   - Add `"filename": "AppIcon.png"` to the existing 1024×1024 iOS universal image entry.
2. Verify the JSON remains valid and matches Xcode's asset-catalog format.

## Out of scope
- No other icon sizes are required; the single 1024×1024 universal iOS entry is the modern App Store / Xcode convention.
- No native code changes are needed; the icon is consumed automatically by the asset catalog.