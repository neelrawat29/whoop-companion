## Problem

On the iOS app, tapping **Scan barcode** in Meals immediately terminates the app. This is an iOS-side crash, not a network/API failure.

### Root cause

`ios-native/project.yml` declares:

```yaml
info:
  path: WhoopCompanion/Info.plist
  properties:
    CFBundleDisplayName: Cove
    ...
```

When xcodegen builds the Xcode project, `info.properties` **overwrites** `Info.plist` with only the keys listed there. `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` (which currently live in the checked-in `Info.plist`) get wiped on the next `xcodegen generate`, along with `CFBundleURLTypes` (the `cove://` OAuth callback scheme).

When `AVCaptureDevice.default(for: .video)` runs without a camera usage-description string in the built Info.plist, iOS terminates the process immediately with an uncatchable exception — exactly the "app just closes" symptom the user sees. `BarcodeScannerView` / `BarcodeScannerController` code itself is fine.

### Where barcode data comes from (answer to the user's second question)

The scanner captures the barcode via `AVFoundation`, then `MealsView.runBarcode()` calls `BarcodeAPI.lookup()`, which POSTs to the TanStack server route `src/routes/api/public/ios/lookup-barcode.ts`. That handler validates the Supabase bearer token and calls `lookupBarcode()` from `src/lib/openfoodfacts.shared.ts`, which fetches `https://world.openfoodfacts.org/api/v2/product/<code>.json` — the free **Open Food Facts** database. No API key. Same code path is used by the web app's meals page.

### Web app status

Web app uses the same server route + Open Food Facts pipeline; the desktop web flow is manual barcode entry (no camera), so this iOS-only crash doesn't affect it.

## Fix

Move the required Info.plist keys into `ios-native/project.yml` under `info.properties` so xcodegen preserves them:

- `NSCameraUsageDescription` — camera prompt string
- `NSPhotoLibraryUsageDescription` — photo-library prompt string
- `CFBundleURLTypes` — `cove://` OAuth callback scheme (so Sign in with Apple / OAuth redirect keeps working after regen)

After this change, regenerating the Xcode project will produce an `Info.plist` that includes the camera usage description, and tapping **Scan barcode** will show the standard iOS camera permission prompt on first use and then open the live camera preview instead of crashing.

No Swift code changes needed. `BarcodeScannerView.swift`, `MealsView.swift`, and the server route stay as-is.

## Files to change

- `ios-native/project.yml` — add the three keys under `targets.WhoopCompanion.info.properties`.

## Verification

- User runs `xcodegen generate` (or their existing build script) in `ios-native/`, rebuilds in Xcode, taps **Scan barcode** → iOS shows "Cove would like to access the camera" prompt → allow → live camera preview appears → scanning a product barcode calls the lookup endpoint and prefills macros from Open Food Facts.
