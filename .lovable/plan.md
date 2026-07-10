# Floating AI Coach Button — iOS Native

Mirror the web `ChatBubble`: a persistent floating action button (FAB) over the tab bar that opens a Coach chat sheet using the shared `quick` thread, so conversations sync between web and iOS.

## Files

**New**
- `ios-native/WhoopCompanion/Features/Chat/CoachBubble.swift` — `CoachBubbleHost`, `CoachFAB`, `CoachQuickChatSheet`, `CoachQuickChatVM`, and `CoachBubbleVisibility` observable env.
- `ios-native/WhoopCompanion/Assets.xcassets/CoachAvatar.imageset/` — generated avatar (1x/2x/3x PNGs + `Contents.json`).

**Edited**
- `ios-native/WhoopCompanion/Shared/TabRoot.swift` — wrap `TabView` in `CoachBubbleHost { … }` and inject `CoachBubbleVisibility` into the environment.
- `ios-native/WhoopCompanion/Features/Chat/ChatView.swift` — on appear set `visibility.isHidden = true`, on disappear reset.
- `ios-native/WhoopCompanion/Features/Chat/ChatThreadListView.swift` — same hide/show behavior.

## Behavior

- **FAB**: circular button, bottom-trailing, ~90pt above safe area (clears tab bar), 56pt diameter, `Theme.accent` fill, coach avatar image inside, shadow, tap → light haptic → present sheet.
- **Sheet**: `.sheet(isPresented:)` with detents `[.medium, .large]`, drag indicator visible.
  - Header: coach avatar + "Coach" title + "Open full" button (`arrow.up.right.square`) + Close (`xmark`).
  - Body: existing `ChatView(threadId: quickThreadId)`.
  - "Open full": promotes thread (`kind = 'full'`), dismisses sheet, then programmatically switches to the More tab and pushes `ChatView`. To keep it simple, use a `NotificationCenter` or shared `@Observable` router flag that `TabRoot`/`MoreView` observes to navigate. Alternative: just dismiss and let the user open Chats manually — simpler but less delightful.
- **Quick thread resolver** (`CoachQuickChatVM`): mirrors `src/components/chat/ChatBubble.tsx` — SELECT newest `chat_threads` where `kind = 'quick'`; if none, INSERT one with `kind = 'quick'`, `title = 'Quick chat'`. This ensures web and iOS use the same row (RLS scopes to the user).
- **Auto-hide**: `CoachBubbleVisibility` observable with `isHidden: Bool`; FAB reads it and returns `EmptyView` when hidden. `ChatView`/`ChatThreadListView` toggle it via `.onAppear`/`.onDisappear`. Auth screens live outside `TabRoot`, so no changes needed.

## Avatar asset

- Generate a friendly coach avatar (rounded square, matches web `coach-avatar.png` vibe) via `imagegen--generate_image` at 1024×1024.
- Downscale to 60/120/180 PNGs and drop into `CoachAvatar.imageset/` with a proper `Contents.json` referencing 1x/2x/3x.
- Reference in SwiftUI as `Image("CoachAvatar")`.

## Sync guarantee

Both platforms query `chat_threads` filtered by `user_id = auth.uid()` and `kind = 'quick'`, ordered by `updated_at DESC LIMIT 1`, and insert with the same `kind` when missing. Same row → same `chat_messages` → conversations synced automatically. No schema changes needed.

## Open decision

For the "Open full" action inside the sheet, I'll default to the **simpler variant**: promote the thread to `kind = 'full'` and dismiss the sheet with a toast/info to open Chats from the More tab. If you'd prefer automatic navigation to that thread, say so and I'll add the tab-switch + navigation plumbing.
