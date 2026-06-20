Build an AI health/fitness coach chatbot scoped strictly to the user's wellness journey, with threaded conversations persisted to the database and personalized using the signed-in user's actual data (recovery, sleep, weight, meals, supplements, habits). Reachable from a dedicated `/chat` page and a floating bubble visible on every authenticated page.

### Stack
- AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`) via the Lovable AI Gateway provider.
- Default model: `google/gemini-3-flash-preview`.
- Streaming server route at `src/routes/api/chat.ts` using `createFileRoute` + `streamText` + `toUIMessageStreamResponse`.
- AI Elements primitives (`conversation`, `message`, `prompt-input`, `shimmer`) installed via `bun x ai-elements@latest add ...`.

### Database (migration)
Two new tables, both scoped to `auth.uid()` with RLS + GRANTs:
- `chat_threads`: `id`, `user_id`, `title` (nullable, auto-derived from first message), `created_at`, `updated_at`.
- `chat_messages`: `id`, `thread_id` (FK → chat_threads, on delete cascade), `user_id`, `role` (`user` | `assistant`), `parts` (jsonb — the AI SDK `UIMessage["parts"]` shape), `created_at`.
RLS: users only see/insert/delete their own rows. `updated_at` trigger on `chat_threads` bumps when new messages arrive.

### Routes
- `src/routes/_authenticated/chat.tsx` — layout with thread sidebar + `<Outlet />`. Index redirects to most recent thread or creates a new one.
- `src/routes/_authenticated/chat.$threadId.tsx` — the active chat window, keyed by `threadId`.
- `src/routes/api/chat.ts` — streaming POST endpoint (see below).

### Server route (`/api/chat`)
- Reads `{ threadId, messages }` from body.
- Verifies the thread belongs to the signed-in user via `requireSupabaseAuth`-style bearer check (uses the publishable client + access token from the `Authorization` header, mirroring `meals.functions.ts`).
- Loads the user's recent context (last 14 days of `daily_entries` + `habits_log`, latest 5 `weight_entries`, today's `meals`, current `user_supplements`, `profile.weight_goal_*`) and injects it as a compact, structured **system prompt block**.
- System prompt enforces scope: "You are a health and fitness coach. Only answer questions about the user's health, fitness, sleep, recovery, nutrition, supplements, weight, habits, or related wellness topics. If asked anything off-topic (coding, news, general trivia, etc.), politely refuse in one sentence and steer back."
- `streamText({ model, system, messages: convertToModelMessages(messages), abortSignal: request.signal })`.
- `toUIMessageStreamResponse({ originalMessages, onFinish })` — `onFinish` writes the assistant message row to `chat_messages` (skipped on abort).

### Client — full-page chat
- `chat.$threadId.tsx` uses `useChat` keyed by `threadId`, transport `/api/chat`, initial messages loaded from `chat_messages` for that thread via TanStack Query.
- Layout: AI Elements `Conversation` + `Message`/`MessageContent`/`MessageResponse` (markdown), `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` + `PromptInputSubmit` (stop button while streaming).
- Sidebar: list of threads (most recent first), "New chat" button (creates row, navigates to `/chat/$id`), delete-thread icon. Selecting a thread navigates to its URL.
- Empty state on a fresh thread: domain-specific welcome (e.g. "Ask me about your recovery, sleep, training, or nutrition") + 3 suggested prompts ("Why was my recovery low yesterday?", "What should I eat post-workout?", "How am I tracking toward my weight goal?").
- Client `onFinish({ isAbort })` persists the partial message when the user stops mid-stream.

### Floating bubble
- New `src/components/chat/ChatBubble.tsx`: fixed bottom-right circular button with a chat icon (custom, not `Sparkles`). On click, opens a slide-in panel (`Sheet` from shadcn, right side) containing a compact version of the chat UI bound to a dedicated "Quick chat" thread (auto-created per user, reused across sessions — separate row in `chat_threads` flagged via title `"Quick chat"`, or stored as the most-recent untitled thread).
- Mounted once in `src/routes/_authenticated/route.tsx` so it appears on every authenticated page **except** `/chat/*` (hide there to avoid duplication).
- Includes "Open full chat" link that navigates to the matching thread URL.

### Navigation
- Add "Chat" entry to `AppShell.tsx` sidebar/nav with a chat icon, linking to `/chat`.

### Identity
- Generate a small mascot/logo image for the coach (e.g. friendly stylized heart-pulse icon) via `imagegen` and use it as the avatar in assistant messages, the chat-empty state, and the floating bubble — not `Sparkles`.

### Acceptance checks
- Create two threads, send messages in each, reload — both restore independently.
- Ask an off-topic question ("write me a poem about cats") — assistant politely declines and redirects to health/fitness.
- Ask "How did I sleep last week?" — assistant references actual `sleep_hours` data from `daily_entries`.
- Stop mid-stream — partial assistant message persists with `_Stopped._` marker.
- Floating bubble opens on `/log`, `/meals`, `/weight`, etc.; hidden on `/chat/*`.
- Submit button shows stop icon (not spinner) during `submitted`/`streaming`.

### Out of scope (can be follow-ups)
- Voice input.
- Sharing/exporting conversations.
- Multi-user / group chat.
- Editing past assistant messages or branching.