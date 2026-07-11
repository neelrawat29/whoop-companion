## 1. Log page — save feedback (Toast + haptic, stay on page)

Today the Log page only flips a tiny `status` text at the bottom of the form after saving. It's easy to miss, the Save button doesn't confirm anything visually, and there's no haptic. We'll fix that without changing the flow — you stay on the page and can keep editing.

**Changes on the Log screen:**
- On successful save: fire a success haptic (`UINotificationFeedbackGenerator.notificationOccurred(.success)`).
- Show a green pill toast "Entry saved" that slides in from the top and auto-dismisses after ~2s. Uses a lightweight SwiftUI overlay (no extra dependency).
- The Save button briefly morphs to "Saved ✓" for ~1s then returns to "Save entry", so the button itself confirms the action.
- On failure: error haptic + red toast with the error message (replaces the current inline red text).
- Remove the old inline `status` text row — the toast replaces it.
- Save button gets a filled, prominent style and stays enabled so the visual anchor is obvious.

**Reusable toast:** a small `ToastPresenter` view modifier under `Shared/` so we can reuse it later (e.g. Meals, Supplements) without repeating code.

## 2. Keyboard "Done" button vanishing

Root cause: the global `UITextField` / `UITextView` `becomeFirstResponder` swizzle in `Shared/KeyboardAccessory.swift`. It attaches a UIToolbar the first time a field becomes first responder, then never re-checks. On the Meals page, SwiftUI's `TextField(text:, axis: .vertical)` is backed by a `UITextView` that SwiftUI reconfigures on layout — it swaps or clears `inputAccessoryView` after our one-shot install, so Done disappears. Because the same underlying UIKit instances get reused across screens (SwiftUI recycles hosting text views), Done then stays missing on every keyboard opened afterwards until the app relaunches. Swizzling core UIKit responder methods app-wide also risks breaking system-provided text fields (PhotosPicker search, alerts, etc.).

**Fix:** delete the swizzle and use SwiftUI's native keyboard toolbar.

- Remove `Shared/KeyboardAccessory.swift` and its `KeyboardAccessorySetup.install()` call in `WhoopCompanionApp.swift`.
- Add `Shared/KeyboardDoneToolbar.swift`: a `View` extension `.keyboardDoneToolbar()` that uses `@FocusState private var focused: Bool` and attaches a `ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focused = false } }`. Because `.focused($focused)` is set on the wrapping container (Form / ScrollView), tapping Done resigns whatever field is currently focused via `UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, ...)` — SwiftUI routes this correctly and it works for both `TextField` and vertical/multiline text fields.
- Apply `.keyboardDoneToolbar()` once at the top-level container of each screen that has text/number input: `LogView` (Form), `MealsView` (Form/ScrollView), `SupplementsView`, `WeightView`, `SettingsView`, `ChatView`, barcode manual-entry sheet. One modifier per screen = exactly one Done button, always present.
- Keep `.scrollDismissesKeyboard(.interactively)` where it's already used.

## Files touched

- `ios-native/WhoopCompanion/Features/Log/LogView.swift` — toast overlay, animated Save button label, remove inline status row, apply `.keyboardDoneToolbar()`.
- `ios-native/WhoopCompanion/Features/Log/LogViewModel.swift` — expose a transient `savedAt: Date?` (or a `didSave` trigger) the view observes to fire haptic + toast; keep `status` only for error messaging routed to the toast.
- `ios-native/WhoopCompanion/Shared/Toast.swift` (new) — `Toast` model + `.toast(_ binding:)` view modifier (top-anchored, auto-dismiss, safe-area aware, respects Reduce Motion).
- `ios-native/WhoopCompanion/Shared/Haptics.swift` — add `Haptics.success()` / `Haptics.error()` helpers if not already present; reuse existing file.
- `ios-native/WhoopCompanion/Shared/KeyboardDoneToolbar.swift` (new) — `.keyboardDoneToolbar()` modifier.
- `ios-native/WhoopCompanion/Shared/KeyboardAccessory.swift` — deleted.
- `ios-native/WhoopCompanion/WhoopCompanionApp.swift` — remove `KeyboardAccessorySetup.install()`.
- `ios-native/WhoopCompanion/Features/Meals/MealsView.swift`, `Features/Supplements/SupplementsView.swift`, `Features/Weight/WeightView.swift`, `Features/Settings/SettingsView.swift`, `Features/Chat/ChatView.swift`, and any other screens with input — add `.keyboardDoneToolbar()` at the root container.

## Out of scope

- Web app Log page (this is iOS-only, per your request).
- Changing the save data model or Supabase schema.
- Redesigning the Log form layout beyond the Save button styling.

## Verification

- Log page: tap Save → feel haptic, see green "Entry saved" toast at top, Save button shows "Saved ✓" briefly, form values persist and reload on date change.
- Force a save error (offline) → error haptic + red toast with message.
- Meals page: open keyboard on "What did you eat?" (multiline), "Portion notes", and the barcode manual-entry sheet → Done button is visible every time; tapping Done dismisses the keyboard.
- Open keyboard on Log → Meals → Supplements → Weight in sequence → Done appears every time, no duplicates.
