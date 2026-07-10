import SwiftUI

struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: String
    var text: String
    init(id: UUID = UUID(), role: String, text: String) {
        self.id = id; self.role = role; self.text = text
    }
}

struct ChatView: View {
    let threadId: UUID?
    @Environment(CoachBubbleVisibility.self) private var coachVisibility: CoachBubbleVisibility?
    @State private var messages: [ChatMessage] = []
    @State private var input: String = ""
    @State private var isStreaming = false
    @State private var loaded = false

    init(threadId: UUID? = nil) { self.threadId = threadId }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { m in
                            HStack {
                                if m.role == "user" { Spacer() }
                                Text(m.text.isEmpty && isStreaming && m.role == "assistant" ? "…" : m.text)
                                    .padding(10)
                                    .background(m.role == "user" ? Theme.accent.opacity(0.25) : Color.gray.opacity(0.15),
                                                in: RoundedRectangle(cornerRadius: 14))
                                if m.role != "user" { Spacer() }
                            }.id(m.id)
                        }
                    }.padding()
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            Divider()
            HStack {
                TextField("Ask something…", text: $input, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.title2)
                }
                .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || isStreaming)
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Chat")
        .task {
            if !loaded { await loadThread(); loaded = true }
        }
    }

    // MARK: - Persistence

    struct DbMessage: Codable {
        let id: UUID?
        let role: String
        let content: String
        let created_at: String?
    }

    private func loadThread() async {
        guard let threadId else { return }
        do {
            let rows: [DbMessage] = try await SupabaseManager.shared.client
                .from("chat_messages")
                .select("id, role, content, created_at")
                .eq("thread_id", value: threadId)
                .order("created_at", ascending: true)
                .execute().value
            messages = rows.map { ChatMessage(id: $0.id ?? UUID(), role: $0.role, text: $0.content) }
        } catch { /* silent — new threads have no rows */ }
    }

    private func persist(role: String, content: String) async {
        guard let threadId else { return }
        guard let userId = try? await SupabaseManager.shared.client.auth.session.user.id else { return }
        struct Insert: Encodable { let thread_id: UUID; let user_id: UUID; let role: String; let content: String }
        _ = try? await SupabaseManager.shared.client.from("chat_messages")
            .insert(Insert(thread_id: threadId, user_id: userId, role: role, content: content))
            .execute()
    }

    // MARK: - Send

    func send() async {
        let userText = input.trimmingCharacters(in: .whitespaces)
        guard !userText.isEmpty else { return }
        let userMsg = ChatMessage(role: "user", text: userText)
        messages.append(userMsg)
        input = ""
        await persist(role: "user", content: userText)

        var assistant = ChatMessage(role: "assistant", text: "")
        messages.append(assistant)
        let assistantIdx = messages.count - 1
        isStreaming = true
        defer { isStreaming = false }

        struct Body: Encodable {
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
        let payload = Body(messages: Array(history))

        do {
            let data = try JSONEncoder().encode(payload)
            for try await line in APIClient.shared.streamChat(body: data) {
                // AI SDK UI message stream uses `data: {json}\n\n`.
                guard line.hasPrefix("data:") else { continue }
                let payloadStr = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if payloadStr == "[DONE]" { break }
                guard let d = payloadStr.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any]
                else { continue }
                // Accept common shapes: {"type":"text-delta","delta":"..."} or {"delta":"..."} or OpenAI-ish choices.
                if let delta = obj["delta"] as? String {
                    assistant.text += delta
                    messages[assistantIdx] = assistant
                } else if let text = obj["text"] as? String {
                    assistant.text += text
                    messages[assistantIdx] = assistant
                } else if let choices = obj["choices"] as? [[String: Any]],
                          let delta = choices.first?["delta"] as? [String: Any],
                          let content = delta["content"] as? String {
                    assistant.text += content
                    messages[assistantIdx] = assistant
                }
            }
        } catch {
            assistant.text = "Error: \(error.localizedDescription)"
            messages[assistantIdx] = assistant
        }
        if !assistant.text.isEmpty {
            await persist(role: "assistant", content: assistant.text)
        }
    }
}
