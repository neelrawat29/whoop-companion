# Wrap Whoop Companion as a native iOS app (Capacitor)

Goal: ship a real `.ipa` you can install on your iPhone without the App Store, with push notifications and room to add other native features later.

## Approach

Use **Capacitor** to wrap the existing web app in a native iOS shell. Capacitor produces a real Xcode project + native binary (not a PWA), supports push notifications, camera, biometrics, etc., and lets you sideload via AltStore / Sideloadly / a free Apple Developer account.

Important: the actual Xcode build + sideload step **must happen on your Mac** (or a Mac in the cloud like MacInCloud). Lovable's sandbox is Linux and cannot run `xcodebuild`. What I'll do here is set up everything so that on your Mac you just run a handful of commands.

## What I'll add to the project

### 1. Capacitor setup
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`.
- Add `capacitor.config.ts` pointing at the built web app:
  - `appId`: `app.lovable.whoopcompanion` (changeable)
  - `appName`: `Whoop Companion`
  - `webDir`: `dist` (the Vite/TanStack client build output)
  - `server.iosScheme`: `https`
- Configure it to load the **published Lovable URL** (`https://whoop-companion.lovable.app`) in production so the app stays in sync with deploys without rebuilding the binary every time. This is the standard pattern for Capacitor-wrapped Lovable apps.

### 2. Push notifications
- Install `@capacitor/push-notifications`.
- Add a small `src/lib/push.ts` that:
  - Requests permission on first launch (iOS only path, no-op on web).
  - Registers the device, grabs the APNs token, and stores it in a new `device_tokens` table in Lovable Cloud (`user_id`, `platform`, `token`, RLS scoped to the user).
- Add a `useEffect` in the authenticated layout that calls the register function once the user is signed in.
- Sending pushes from the server is out of scope for this turn — we'll just capture tokens. You'd later send via APNs from a server function when you want to trigger a notification.

### 3. iOS-friendly tweaks
- Add safe-area padding utilities so the status bar / home indicator don't overlap your UI (`env(safe-area-inset-*)` in `src/styles.css`).
- Add `@capacitor/status-bar` and `@capacitor/splash-screen` with sensible defaults (dark content on light bg, splash hides on app ready).
- Generate an app icon + splash from your existing `app-icon-512.png` using `@capacitor/assets` (config only — actual asset generation runs on your Mac).

### 4. Build instructions
- Add `IOS_BUILD.md` at the project root with the exact commands to run on your Mac after pulling the repo:
  ```
  bun install
  bun run build
  npx cap add ios
  npx cap sync ios
  npx cap open ios
  ```
  Then in Xcode: select your free Apple ID as signing team → plug in iPhone → Run. The app installs for 7 days (free account limit) or 1 year (paid $99/yr developer account). Alternatively, sideload the resulting `.ipa` via AltStore or Sideloadly.
- Document the push-notification entitlement toggle in Xcode (`Signing & Capabilities → + Capability → Push Notifications`).

### 5. What stays the same
- No changes to your existing routes, UI, auth, chat, or data model — Capacitor just wraps what's already there.
- The PWA scaffolding stays untouched and harmless; you simply won't use it.

## Files touched

- **New**: `capacitor.config.ts`, `src/lib/push.ts`, `IOS_BUILD.md`, migration for `device_tokens` table.
- **Edited**: `package.json` (deps), `src/routes/_authenticated/route.tsx` (call push register), `src/styles.css` (safe-area utilities).

## Out of scope (follow-ups)

- Actually sending push notifications from the backend (needs APNs key upload + a server function).
- Android wrapper (same Capacitor project, separate `npx cap add android` step).
- Publishing to TestFlight / App Store.
- Camera, biometrics, HealthKit — easy to add later once the shell is working.

## Heads-up on limits

- **Free Apple ID sideload**: app expires after 7 days, must reinstall. Limit of 3 sideloaded apps.
- **Paid Apple Developer ($99/yr)**: 1-year signing, no 3-app limit, required for real push notifications in production.
- A **Mac** (or cloud Mac) is required at least once to produce the `.ipa`. There is no Linux-only path to a signed iOS build.