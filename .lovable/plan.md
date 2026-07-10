
## Goal
Bring the iOS chat experience up to parity with the web Coach (the floating bubble already exists on iOS, but the chat inside it is bare and has a real schema bug), and finish the Cove rebrand across the web app + shared configs.

## Part 1 — iOS Coach parity with web

### Fix the broken chat_messages schema mismatch (blocker)
`chat_messages` has columns `role` + `parts` (JSON), no `content` column. `ChatView.swift` currently reads/writes a nonexistent `content` field:
- Loads with `.select("id, role, content, created_at")` → messages never populate.
- Persists via `Insert(..., content: content)` → wrapped in `try?`, silently failing, so nothing is saved.

Fix by switching to the same shape the web uses: `parts: [{ type: "text", text: "..." }]` encoded as JSON.

### Bring ChatView closer to web ChatWindow
Redesign `ios-native/WhoopCompanion/Features/Chat/ChatView.swift`:
- **Empty state**: coach avatar / icon, "Hi, I'm Coach 👋" copy, and 2–4 tappable suggestion chips (same suggestions as web: recovery, weight goal, post-workout, sleep). Tapping a chip sends it.
- **Message bubbles**: assistant messages get a small coach avatar to the left; user messages right-aligned; assistant text rendered as markdown via `Text(.init(...))` (SwiftUI's built-in AttributedString markdown) — no new dependency.
- **Thinking indicator**: while `isStreaming` and assistant text is still empty, show a pulsing "Coach is thinking…" row with a shimmering opacity animation.
- **Stop button**: while streaming, swap the send button for a stop button that cancels the URLSession task; on stop, append `\n\n_Stopped._` to the last assistant message and persist it (mirroring web `onFinish` isAbort logic).
- Keep the existing `CoachBubbleHost` / FAB / promote-to-full flow untouched — only the chat surface changes.

### Match the web's floating bubble icon
In `CoachFAB` (`CoachBubble.swift`), swap the current `waveform.path.ecg` glyph for `message.fill` (SwiftUI SF Symbol equivalent of web's lucide `MessageCircle`) inside the existing `ChatBubbleShape`. Same swap on the sheet toolbar leading item.

### Cancellation plumbing
Extend `APIClient.streamChat` (or a small wrapper) to expose a way to cancel the in-flight URLSession task — currently the stream can't be interrupted. Add a `URLSessionDataTask`-based variant, or wrap the existing call in a `Task` we hold and cancel from ChatView.

### Out of scope for iOS
- No new chat threads UI, no swapping to `@ai-sdk/react` (Swift has no equivalent) — we keep the current hand-rolled SSE parser.
- No streamdown-quality rendering (tables, code blocks). SwiftUI markdown handles bold/italic/links, which covers most coach replies.

## Part 2 — "Whoop Companion" → "Cove" everywhere else

Web files (iOS strings were already updated in a prior turn):
- `capacitor.config.ts` — `appId: "app.lovable.cove"`, `appName: "Cove"`
- `public/manifest.webmanifest` — `name` / `short_name` → Cove
- `src/routes/__root.tsx` — page title, og:title, twitter:title, meta description
- `src/routes/auth.tsx` — head title + visible brand `<span>`
- `src/routes/reset-password.tsx` — head title
- `src/routes/trust.tsx` — head title, meta description, and 6 in-copy references
- `src/routes/_authenticated/insights.biological-age.tsx` — head title
- `src/components/AppShell.tsx` — two brand `<span>`s (desktop + mobile header)
- `src/routes/_authenticated/community.$groupId.tsx` — group invite share text
- `src/lib/openfoodfacts.shared.ts` — HTTP `User-Agent` header → `Cove/1.0 (barcode lookup)`

Not renaming:
- Xcode target name / folder `WhoopCompanion/` (display name is already "Cove" via `CFBundleDisplayName`; renaming the target folder would churn the project graph without user benefit)
- Bundle identifier `app.lovable.whoopcompanion` (kept intentionally last turn to avoid App Store disruption)

## Verification
- `bunx tsgo --noEmit` after web edits.
- iOS changes are Swift-only and can't be typechecked in the sandbox; the fix to `parts` unblocks message persistence which was previously silently broken.
