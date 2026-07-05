
# iOS Native App — UX Polish & Parity Pass

Scope: **iOS-native only** (`ios-native/WhoopCompanion/`). No web or backend changes.

## 1. Input field UX

Adopt consistent patterns across every form (Log, Settings, Weight, Meals, Supplements, Import, Community, Auth):

- **Section headers + footers** on `Form` sections describing purpose ("Required to compute recovery zones", "Optional — leave blank if unsure").
- **Placeholders** in every `TextField`/`SecureField` showing an example value (e.g. "e.g. 72.5", "you@example.com").
- **Required vs optional badges**: small "Required" (accent color) or "Optional" (secondary) chip next to labels. Reusable `FieldLabel(_:required:)` view.
- **Units suffix** inside numeric fields (kg, cm, bpm, kcal, g, hrs) via trailing text.
- **Keyboard types**: `.decimalPad` / `.numberPad` / `.emailAddress` / `.URL` as appropriate, plus `.textInputAutocapitalization` and `.autocorrectionDisabled` where relevant.
- **Inline validation**: red helper text under invalid fields; disable Save when required fields empty.
- **Focus management**: `@FocusState` chain with a "Done" toolbar button on the number pad.

## 2. Meals — AI estimate

Extend `MealsView` / `MealsViewModel` to match the web:

- Per-meal-slot editor (Breakfast/Lunch/Dinner + Snacks list, "Add snack").
- Fields: description (multiline), portion notes (optional), kcal/protein/carbs/fat.
- **"AI estimate" button** calling `estimateMeal` server function via `APIClient.callServerFn(name: "estimateMeal", body: {description, portionNotes, userKcalHint})`.
- **"Re-estimate to my kcal"** secondary action when kcal already filled.
- Show returned `assumptions` as italic caption.
- Daily totals card (kcal + macro breakdown).
- Date picker with a "Today" quick-jump chip.

## 3. Google button — official branding

Replace generic `Image(systemName: "globe")` in `AuthView` with a Google-branded button:

- Bundle Google "G" logo as an SF asset (vector PDF in `Assets.xcassets/GoogleLogo.imageset`, template = false to preserve colors).
- White background, `#DADCE0` 1pt border, `#1F1F1F` text "Continue with Google", SF Pro semibold — per Google branding guidelines.
- Height 48pt, corner radius 10, matching Apple button next to it.

## 4. Menu (More tab) — redesign

Replace basic `List` with a card-based hub matching Arctic Frost theme:

- Grouped cards (Track / Coach / Data / App) with icon tiles.
- Each tile: SF Symbol in accent-tinted rounded square, title, one-line description, chevron.
- Header block with user display name, email, and avatar initial.
- Quick actions row (Settings gear, Sign out).

## 5. Web-parity audit

Compare each `src/routes/_authenticated/*` against `ios-native/WhoopCompanion/Features/*` and close gaps. Known deltas to fix:

| Web page | Gap in iOS | Fix |
|---|---|---|
| `meals.tsx` | Missing AI estimate, portion notes, macros totals, snack list | Item 2 above |
| `log.tsx` | Verify all fields (energy, mood, hydration, drinks, strain, note, bedtime, wake time, work location, supplements taken) present | Add any missing |
| `settings.tsx` | Verify threshold sliders, body baselines, weight goal, sign-out | Add any missing |
| `insights.index.tsx` + `insights.biological-age.tsx` | Verify charts and bio-age dial rendered | Add any missing |
| `weight.tsx` | Verify chart, goal ring, unit toggle | Add any missing |
| `supplements.tsx` | Verify library CRUD + macros | Add any missing |
| `community.*` | Verify list, detail leaderboard, join-by-code, settings (rename, regen code, remove members) | Add any missing |
| `chat.*` | Verify thread list, streaming, delete thread | Add any missing |
| `import.tsx` | Verify CSV + screenshot AI | Confirmed present |
| `reset-password.tsx` | Not present natively | Add a `ResetPasswordView` reachable from AuthView "Forgot password?" |

Deliverable per page: a short SwiftUI diff bringing feature set to 1:1. Any web-only affordance that can't be replicated (e.g. sonner toasts) uses the closest native equivalent (`.alert` / inline banner).

## Technical notes

- New reusable views in `Shared/`: `FieldLabel.swift`, `FormFieldStyle.swift`, `GoogleSignInButton.swift`, `MenuTile.swift`.
- Google logo asset added to `Assets.xcassets/GoogleLogo.imageset/` (PDF + Contents.json, preserve vector data).
- No new SPM dependencies.
- After changes: user runs `cd ios-native && xcodegen generate` to sync Xcode project.

## Out of scope

- Web app, edge functions, database schema, `src/**`.
- Push notifications and HealthKit integration (not requested).
