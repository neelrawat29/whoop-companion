import SwiftUI

struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: String
    var text: String
    init(id: UUID = UUID(), role: String, text: String) {
        self.id = id; self.role = role; self.text = text
    }
}

private let coachSuggestions = [
    "Why was my recovery low yesterday?",
    "How am I tracking toward my weight goal?",
    "What should I eat post-workout?",
    "How's my sleep been this week?",
]

struct ChatView: View {
    let threadId: UUID?
    @Environment(CoachBubbleVisibility.self) private var coachVisibility: CoachBubbleVisibility?
    @State private var messages: [ChatMessage] = []
    @State private var input: String = ""
    @State private var isStreaming = false
    @State private var loaded = false
    @State private var streamTask: Task<Void, Never>?
    @FocusState private var inputFocused: Bool

    init(threadId: UUID? = nil) { self.threadId = threadId }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    if messages.isEmpty && !isStreaming {
                        emptyState
                            .padding(.horizontal)
                            .padding(.top, 32)
                    } else {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(messages) { m in
                                messageRow(m).id(m.id)
                            }
                            if isStreaming, let last = messages.last,
                               last.role == "assistant", last.text.isEmpty {
                                thinkingRow.id("thinking")
                            }
                        }
                        .padding()
                    }
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
                .onChange(of: messages.last?.text) { _, _ in
                    if let last = messages.last {
                        withAnimation(.easeOut(duration: 0.15)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            Divider()
            composer
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Chat")
        .task {
            if !loaded { await loadThread(); loaded = true }
            inputFocused = true
        }
        .onChange(of: threadId) { _, _ in inputFocused = true }
        .onChange(of: isStreaming) { _, streaming in
            if !streaming { inputFocused = true }
        }
        .onAppear { coachVisibility?.isHidden = true }
        .onDisappear {
            coachVisibility?.isHidden = false
            streamTask?.cancel()
        }
    }

    // MARK: - Subviews

    private var emptyState: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(Theme.accent.opacity(0.15)).frame(width: 72, height: 72)
                Image(systemName: "message.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }
            VStack(spacing: 4) {
                Text("Hi, I'm Coach 👋").font(.headline)
                Text("Ask me anything about your recovery, sleep, training, nutrition, supplements, or weight journey. I'll use your logged data to give personal answers.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: 380)

            VStack(spacing: 8) {
                ForEach(coachSuggestions, id: \.self) { s in
                    Button {
                        input = s
                        Task { await send() }
                    } label: {
                        Text(s)
                            .font(.subheadline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(Theme.cardBorder, lineWidth: 1)
                            )
                            .foregroundStyle(Theme.textPrimary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 4)
        }
    }

    @ViewBuilder
    private func messageRow(_ m: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if m.role == "user" {
                Spacer(minLength: 40)
                Text(m.text)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.white)
                    .textSelection(.enabled)
            } else {
                assistantAvatar
                assistantBubble(m.text)
                Spacer(minLength: 40)
            }
        }
    }

    private var assistantAvatar: some View {
        ZStack {
            Circle().fill(Theme.accent.opacity(0.15)).frame(width: 28, height: 28)
            Image(systemName: "message.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.accent)
        }
    }

    @ViewBuilder
    private func assistantBubble(_ text: String) -> some View {
        let rendered: Text = {
            if let attr = try? AttributedString(
                markdown: text,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            ) {
                return Text(attr)
            }
            return Text(text)
        }()
        rendered
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(Color.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
            .foregroundStyle(Theme.textPrimary)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var thinkingRow: some View {
        HStack(alignment: .top, spacing: 8) {
            assistantAvatar
            ShimmerText(text: "Coach is thinking…")
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(Color.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
            Spacer(minLength: 40)
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Ask Coach about your health…", text: $input, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...5)
                .focused($inputFocused)
                .onSubmit { Task { await send() } }
            if isStreaming {
                Button {
                    streamTask?.cancel()
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.red)
                }
                .accessibilityLabel("Stop")
            } else {
                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.title2)
                }
                .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding()
    }

    // MARK: - Persistence (uses `parts` JSON to match web schema)

    struct DbPart: Codable { let type: String; let text: String }
    struct DbMessage: Codable {
        let id: UUID?
        let role: String
        let parts: [DbPart]
        let created_at: String?
    }

    private func loadThread() async {
        guard let threadId else { return }
        do {
            let rows: [DbMessage] = try await SupabaseManager.shared.client
                .from("chat_messages")
                .select("id, role, parts, created_at")
                .eq("thread_id", value: threadId)
                .order("created_at", ascending: true)
                .execute().value
            messages = rows.map { row in
                let text = row.parts.filter { $0.type == "text" }.map { $0.text }.joined()
                return ChatMessage(id: row.id ?? UUID(), role: row.role, text: text)
            }
        } catch { /* silent — new threads have no rows */ }
    }

    private func persist(role: String, text: String) async {
        guard let threadId else { return }
        guard let userId = try? await SupabaseManager.shared.client.auth.session.user.id else { return }
        struct Insert: Encodable {
            let thread_id: UUID
            let user_id: UUID
            let role: String
            let parts: [DbPart]
        }
        _ = try? await SupabaseManager.shared.client.from("chat_messages")
            .insert(Insert(
                thread_id: threadId, user_id: userId, role: role,
                parts: [DbPart(type: "text", text: text)]
            ))
            .execute()
    }

    // MARK: - Send

    func send() async {
        let userText = input.trimmingCharacters(in: .whitespaces)
        guard !userText.isEmpty, !isStreaming else { return }
        let userMsg = ChatMessage(role: "user", text: userText)
        messages.append(userMsg)
        input = ""


        var assistant = ChatMessage(role: "assistant", text: "")
        messages.append(assistant)
        let assistantIdx = messages.count - 1
        isStreaming = true

        struct Body: Encodable {
            let threadId: String?
            let messages: [Msg]
            struct Msg: Encodable {
                let role: String
                let parts: [Part]
                struct Part: Encodable { let type: String; let text: String }
            }
        }
        let history = messages.dropLast().map {
            Body.Msg(role: $0.role, parts: [.init(type: "text", text: $0.text)])
        }
        let payload = Body(threadId: threadId?.uuidString, messages: Array(history))

        let task = Task { @MainActor in
            defer { isStreaming = false }
            var stopped = false
            do {
                let data = try JSONEncoder().encode(payload)
                for try await line in APIClient.shared.streamChat(body: data) {
                    if Task.isCancelled { stopped = true; break }
                    guard line.hasPrefix("data:") else { continue }
                    let payloadStr = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                    if payloadStr.isEmpty || payloadStr == "[DONE]" { continue }
                    guard let d = payloadStr.data(using: .utf8),
                          let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any]
                    else { continue }
                    // AI SDK v5 UI message stream: {"type":"text-delta","delta":"..."}
                    let type = obj["type"] as? String
                    if type == "text-delta", let delta = obj["delta"] as? String {
                        assistant.text += delta
                        messages[assistantIdx] = assistant
                    } else if let delta = obj["delta"] as? String {
                        assistant.text += delta
                        messages[assistantIdx] = assistant
                    } else if let text = obj["text"] as? String, (type == nil || type == "text") {
                        assistant.text += text
                        messages[assistantIdx] = assistant
                    } else if let choices = obj["choices"] as? [[String: Any]],
                              let delta = choices.first?["delta"] as? [String: Any],
                              let content = delta["content"] as? String {
                        assistant.text += content
                        messages[assistantIdx] = assistant
                    }
                }
            } catch is CancellationError {
                stopped = true
            } catch {
                assistant.text = "Error: \(error.localizedDescription)"
                messages[assistantIdx] = assistant
                return
            }
            if stopped {
                assistant.text += (assistant.text.isEmpty ? "_Stopped._" : "\n\n_Stopped._")
                messages[assistantIdx] = assistant
            }

        }
        streamTask = task
        await task.value
        streamTask = nil
    }
}

// Simple shimmer effect used for the "Coach is thinking…" indicator.
private struct ShimmerText: View {
    let text: String
    @State private var phase: CGFloat = -1

    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .overlay(
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: Theme.accent.opacity(0.6), location: 0.5),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading, endPoint: .trailing
                )
                .frame(width: 60)
                .offset(x: phase * 160)
                .mask(Text(text).font(.subheadline))
                .allowsHitTesting(false)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}
