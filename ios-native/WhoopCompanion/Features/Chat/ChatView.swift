import SwiftUI

struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let role: String
    var text: String
}

struct ChatView: View {
    @State private var messages: [ChatMessage] = []
    @State private var input: String = ""
    @State private var isStreaming = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { m in
                            HStack {
                                if m.role == "user" { Spacer() }
                                Text(m.text)
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
        .navigationTitle("Chat")
    }

    func send() async {
        let userText = input.trimmingCharacters(in: .whitespaces)
        guard !userText.isEmpty else { return }
        messages.append(ChatMessage(role: "user", text: userText))
        input = ""
        let assistantIdx = messages.count
        messages.append(ChatMessage(role: "assistant", text: ""))
        isStreaming = true
        defer { isStreaming = false }

        struct Body: Encodable {
            let messages: [Msg]
            struct Msg: Encodable { let role: String; let content: String }
        }
        let payload = Body(messages: messages.dropLast().map { .init(role: $0.role, content: $0.text) })

        do {
            let data = try JSONEncoder().encode(payload)
            for try await line in APIClient.shared.streamChat(body: data) {
                // Parse SSE: lines starting with "data:" carry JSON chunks.
                guard line.hasPrefix("data:") else { continue }
                let payloadStr = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if payloadStr == "[DONE]" { break }
                if let d = payloadStr.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                    // Try common shapes: {"delta":"..."} / {"text":"..."} / {"choices":[{"delta":{"content":"..."}}]}
                    if let delta = obj["delta"] as? String {
                        messages[assistantIdx].text += delta
                    } else if let text = obj["text"] as? String {
                        messages[assistantIdx].text += text
                    } else if let choices = obj["choices"] as? [[String: Any]],
                              let delta = choices.first?["delta"] as? [String: Any],
                              let content = delta["content"] as? String {
                        messages[assistantIdx].text += content
                    }
                }
            }
        } catch {
            messages[assistantIdx].text = "Error: \(error.localizedDescription)"
        }
    }
}
