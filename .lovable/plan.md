# Native SwiftUI iOS app for Whoop Companion

Build a real Swift/SwiftUI Xcode project — no WebView, no Capacitor — that reuses the existing Lovable Cloud (Supabase) backend. The web app stays untouched.

## What you get

A new `ios-native/` folder at the repo root containing a complete Xcode project (`WhoopCompanion.xcodeproj` + Swift sources) you copy to your Mac and open in Xcode. Same backend, same tables, same auth — different frontend.

## Important limitation up front

Lovable's sandbox is Linux; it cannot compile, run, or lint Swift. I can only **author the source files**. Every build/test happens on your Mac in Xcode. Expect a first-run cycle of small Swift fixes — this is normal for scaffolded native code.

## Feature scope (v1)

All four you selected, built as native SwiftUI screens:

1. **Auth** — email/password + Google (Sign in with Apple added since it's near-free on iOS and Apple requires it if you ship Google). Uses `supabase-swift`.
2. **Daily log** — recovery, HRV, RHR, sleep, habits (energy/mood/hydration/etc.). Writes to `daily_entries` + `habits_log`.
3. **Weight** — entries + chart + goal, backed by `weight_entries` and `profiles`.
4. **Insights + Biological age** — reads `daily_entries`, calls the existing `biological-age` server function via HTTPS (TanStack server fn = plain POST endpoint).
5. **Meals + Supplements** — CRUD on `meals` and `user_supplements`. AI meal parsing calls the existing `meals` server fn over HTTPS.
6. **Community + AI chat** — groups, leaderboard (calls `group_leaderboard` RPC), and chat streaming from `/api/chat` (already public route with SSE).

## Architecture

```text
ios-native/
├── WhoopCompanion.xcodeproj/
├── WhoopCompanion/
│   ├── WhoopCompanionApp.swift        # @main, session bootstrap
│   ├── Config.swift                    # SUPABASE_URL, anon key, API base
│   ├── Supabase/
│   │   ├── SupabaseClient.swift       # shared client + auth state
│   │   └── Models.swift                # Codable structs matching tables
│   ├── Auth/
│   │   ├── AuthView.swift
│   │   └── AuthViewModel.swift
│   ├── Features/
│   │   ├── Log/ (View + ViewModel + repo)
│   │   ├── Weight/
│   │   ├── Insights/
│   │   ├── Meals/
│   │   ├── Supplements/
│   │   ├── Community/
│   │   └── Chat/                       # SSE client for /api/chat
│   ├── Shared/
│   │   ├── TabRoot.swift               # TabView shell
│   │   ├── Theme.swift                 # colors, spacing, typography
│   │   └── Components/                 # buttons, cards, charts
│   └── Assets.xcassets/                # app icon, colors
├── WhoopCompanionTests/
└── README.md                           # build/run/sideload steps
```

- **UI**: SwiftUI + Swift Charts (iOS 16+). Native tab bar, native navigation, native forms.
- **State**: `@Observable` view models (iOS 17+). Deployment target: **iOS 17**.
- **Data**: `supabase-swift` for auth + PostgREST + RPC. `URLSession` for TanStack server fns and SSE.
- **Auth session**: stored in Keychain via `supabase-swift`'s default; no `localStorage` shim needed.
- **Server fns**: called as plain `POST https://whoop-companion.lovable.app/_serverFn/<name>` with the Supabase bearer token. Same wire format the web app uses.
- **Chat SSE**: `URLSession.bytes(for:)` streaming into an `AsyncStream<String>`.

## Backend changes

None required. Existing RLS policies already scope by `auth.uid()`, which works identically for the iOS client. The `device_tokens` table already exists from the Capacitor turn — reused for APNs later (out of scope for v1).

## Design

Native iOS look — SF Pro, system materials, `.regularMaterial` cards, dark-mode aware. Colors mirror the web app's dark palette but expressed as Asset Catalog color sets so they adapt to light/dark automatically.

## Build & run (on your Mac)

Documented in `ios-native/README.md`:

1. Copy `ios-native/` to your Mac.
2. Open `WhoopCompanion.xcodeproj` in Xcode 15+.
3. File → Add Package Dependencies → `https://github.com/supabase/supabase-swift`.
4. Signing & Capabilities → pick your Apple ID team.
5. Plug in iPhone → Run.

Free Apple ID = 7-day install. Paid ($99/yr) = 1 year + push. Sideloadable via AltStore/Sideloadly from the resulting `.ipa`.

## Out of scope (follow-ups)

- Push notifications sending (needs APNs key + server function).
- HealthKit (you chose manual + imports).
- Whoop CSV import screen (kept on web for now; can port later).
- iPad-optimized layouts (works but not tuned).
- App Store submission.

## What stays untouched

The entire web app, Capacitor config, and existing routes/components. If you later want to delete the Capacitor wrapper, that's a separate cleanup.

## Files created

- `ios-native/` folder (~40 Swift files + Xcode project + assets + README).
- No edits to existing web app files.

## Heads-up

Because I can't compile Swift here, plan on 1–2 short follow-up turns to fix Xcode errors you paste back to me after the first build attempt. Scaffolded native apps rarely compile 100% clean on first try.
