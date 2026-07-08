# iOS UX Fixes: Keyboard Dismissal + Meals AI Estimate

Scope: **iOS-native only** (`ios-native/WhoopCompanion/`). No web/backend changes to routes the browser uses; one new **public API route** is added for iOS.

---

## 1. Keyboard has no dismiss button

Number pads (`.numberPad` / `.decimalPad`) have no Return key on iOS, so once the pad appears there is no way to close it. Text-input pads currently also don't dismiss on scroll. Fix in two layers so every form benefits:

### 1a. Global "Done" accessory on number pads
Add a reusable view modifier `KeyboardDoneToolbar` in `Shared/FormComponents.swift`:

```swift
struct KeyboardDoneToolbar: ViewModifier {
    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder),
                        to: nil, from: nil, for: nil)
                }
                .font(.body.weight(.semibold))
            }
        }
    }
}
extension View { func keyboardDoneToolbar() -> some View { modifier(KeyboardDoneToolbar()) } }
```

Update `NumericField` in `FormComponents.swift` to attach `.keyboardDoneToolbar()` automatically, so every existing numeric input in Log, Settings, Weight, Meals, Supplements gets a Done button with no per-call-site change.

### 1b. Swipe-to-dismiss on scrollable screens
Apply `.scrollDismissesKeyboard(.interactively)` on the top-level container of every feature screen so any keyboard (text or number) closes by dragging:

- `MealsView` (ScrollView)
- `LogView` (Form)
- `SettingsView` (Form)
- `WeightView` (ScrollView/Form)
- `SupplementsView` (List/Form)
- `CommunityView` + `GroupDetailView` + `GroupSettingsView`
- `ChatView` (already needs it for the message input)
- `ImportView`
- `AuthView` (small ScrollView wrapping the fields)

### 1c. Tap-to-dismiss fallback
Add a `.background` gesture on the root of each feature view that ends editing when the empty area is tapped:

```swift
.background(
    Color.clear.contentShape(Rectangle())
        .onTapGesture { UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil, from: nil, for: nil) }
)
```

---

## 2. Meals AI estimate broken on iOS

### Root cause
`APIClient.callServerFn` posts to `<origin>/_serverFn/<exportName>` (e.g. `/_serverFn/estimateMeal`). TanStack Start's server-function handler doesn't route by export name — it uses a SHA-256 `functionId` generated at build time and injected into the client bundle. The URL the iOS app builds never matches a real function, so the request 404s / returns the SPA HTML, and `JSONDecoder` fails. Same latent bug affects `biological-age` and every `community.*` server-fn call from iOS; only Meals was hit today because that button was newly wired.

### Fix: expose iOS-facing endpoints as real API routes

Add public API routes under `src/routes/api/public/ios/*` that verify the Supabase bearer token in-handler and reuse the same logic as the existing server functions. Public prefix is required so Lovable's published-site auth wrapper doesn't intercept them; the handler itself enforces auth.

New helper `src/lib/ios-auth.server.ts`:
- `verifyBearer(request)` — reads `Authorization: Bearer <jwt>`, calls `supabase.auth.getUser(token)` with the server publishable client, throws `Response('Unauthorized', 401)` on failure, returns `{ userId, supabase }` (a per-request client with the token so RLS still applies).

New route `src/routes/api/public/ios/estimate-meal.ts`:
- `POST` handler → verify bearer → validate `{ description, portionNotes?, userKcalHint? }` with the same Zod-style checks in `meals.functions.ts` → call the Lovable AI Gateway with the identical system prompt and schema → return JSON `{ kcal, protein_g, carbs_g, fat_g, confidence, assumptions }`.
- Extract the prompt + fetch body from `src/lib/meals.functions.ts` into a shared `src/lib/meals.shared.ts` so both the existing web server function and the new route call one implementation. Web behaviour is unchanged.

iOS side:
- Add `APIClient.callAPI(path:body:)` in `Supabase/APIClient.swift` that POSTs to `<origin>/api/public/ios/<path>` with the bearer header, decodes JSON, and surfaces error bodies.
- Change `MealEstimator.estimate` in `MealsViewModel.swift` to call `callAPI(path: "estimate-meal", body: …)` instead of `callServerFn(name: "estimateMeal", …)`.
- Improve error surfacing in `MealSlotCard.runEstimate`: show the actual error message (`error.localizedDescription`) instead of a generic "Estimate failed" so future failures are debuggable in-app.

### Out of scope for this turn
The same wire-format mismatch affects `biological-age` and `community.*` iOS calls. Fixing those means adding matching `/api/public/ios/*` routes for each. Not included here — call them out in the closing message so the user can green-light a follow-up pass.

---

## Technical notes
- No new SPM dependencies, no schema changes.
- Public route security: every handler must verify the bearer token before doing work; Zod-validate all inputs; never return raw provider errors that could leak the API key.
- Keep `LOVABLE_API_KEY` server-only (read inside the handler, never in a `.functions.ts` module scope).
- After edits, the user regenerates the Xcode project: `cd ios-native && xcodegen generate`.
