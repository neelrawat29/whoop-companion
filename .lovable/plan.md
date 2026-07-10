## Goal

Replace the current circular Coach FAB on the iOS app with a chat-bubble-shaped button (rounded rectangle with a small tail pointing down-right), and swap the avatar for the SF Symbol `waveform.path.ecg`.

## Scope

Only the FAB's visual presentation changes. Sheet behavior, thread sync logic, and auto-hide behavior are unchanged.

## Changes

### `ios-native/WhoopCompanion/Features/Chat/CoachBubble.swift`
Replace the `CoachFAB` view:

- New `ChatBubbleShape: Shape` — rounded rectangle (~14pt radius) with a small triangular tail on the bottom-right pointing down-right.
- `CoachFAB` renders that shape filled with `Theme.accent`, size ~64×54pt (plus ~8pt tail), containing a centered `Image(systemName: "waveform.path.ecg")` in `.title2.weight(.semibold)`, foreground `.white`.
- Keep existing shadow, tap action, haptic, accessibility label ("Open Coach chat"), and spring transition.
- Adjust `.padding(.bottom, ...)` in `CoachBubbleHost` if needed so the tail clears the tab bar (~72pt).

### `CoachQuickChatSheet` toolbar
Swap the `Image("CoachAvatar")` in the leading toolbar item for `Image(systemName: "waveform.path.ecg").foregroundStyle(Theme.accent)` so the sheet header matches the new identity.

### Asset cleanup
Remove the now-unused `CoachAvatar.imageset` (three PNGs + `Contents.json`) so it doesn't ship in the bundle.

## Not changing

- `TabRoot.swift`, `ChatView.swift`, `ChatThreadListView.swift` auto-hide wiring.
- `CoachQuickChatVM` thread resolution / promote logic.
- Web `ChatBubble.tsx` (iOS-only request).

## Technical notes

`ChatBubbleShape` draws with `Path`: rounded rect body, then `move`/`addLine` to form a ~10pt tail at the bottom-right corner, closed subpath. Filling the combined path with `Theme.accent` yields a single continuous bubble+tail with one shadow. The icon sits centered within the rectangle body only (tail excluded from content bounds).
