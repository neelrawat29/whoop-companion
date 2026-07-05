import SwiftUI

struct ChatThread: Codable, Identifiable {
    let id: UUID
    let title: String?
    let updatedAt: String
    let kind: String

    enum CodingKeys: String, CodingKey {
        case id, title, kind
        case updatedAt = "updated_at"
    }
}

@Observable
final class ChatThreadListVM {
    var threads: [ChatThread] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    func load() async {
        do {
            threads = try await client.from("chat_threads")
                .select("id, title, updated_at, kind")
                .eq("kind", value: "full")
                .order("updated_at", ascending: false)
                .execute().value
        } catch { errorMessage = error.localizedDescription }
    }

    func create() async -> UUID? {
        guard let userId = try? await client.auth.session.user.id else { return nil }
        struct Insert: Encodable { let user_id: UUID; let kind: String }
        do {
            let created: [ChatThread] = try await client.from("chat_threads")
                .insert(Insert(user_id: userId, kind: "full"))
                .select("id, title, updated_at, kind")
                .execute().value
            await load()
            return created.first?.id
        } catch { errorMessage = error.localizedDescription; return nil }
    }

    func delete(_ id: UUID) async {
        _ = try? await client.from("chat_threads").delete().eq("id", value: id).execute()
        await load()
    }
}

struct ChatThreadListView: View {
    @State private var vm = ChatThreadListVM()
    @State private var newThreadId: UUID?
    @State private var pushNew = false

    var body: some View {
        List {
            if vm.threads.isEmpty {
                Text("No chats yet. Tap + to start one.")
                    .foregroundStyle(.secondary).font(.footnote)
            }
            ForEach(vm.threads) { t in
                NavigationLink {
                    ChatView(threadId: t.id)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.title ?? "New chat").lineLimit(1)
                        Text(t.updatedAt.prefix(10)).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .swipeActions {
                    Button(role: .destructive) { Task { await vm.delete(t.id) } } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .navigationTitle("Chats")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task {
                        if let id = await vm.create() { newThreadId = id; pushNew = true }
                    }
                } label: { Image(systemName: "square.and.pencil") }
            }
        }
        .navigationDestination(isPresented: $pushNew) {
            if let id = newThreadId { ChatView(threadId: id) }
        }
        .task { await vm.load() }
    }
}
