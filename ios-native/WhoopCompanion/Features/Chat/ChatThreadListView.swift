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
    /// True only while a load-failure is showing, so Retry reloads (vs. dismiss-only for actions).
    var loadFailed = false
    var isLoading = false
    var hasLoaded = false
    private let client = SupabaseManager.shared.client

    func load() async {
        isLoading = true; defer { isLoading = false; hasLoaded = true }
        do {
            threads = try await client.from("chat_threads")
                .select("id, title, updated_at, kind")
                .eq("kind", value: "full")
                .order("updated_at", ascending: false)
                .execute().value
            if loadFailed { errorMessage = nil; loadFailed = false }
        } catch {
            errorMessage = "Couldn't load your chats. " + friendlyError(error.localizedDescription)
            loadFailed = true
        }
    }

    func create() async -> UUID? {
        guard let userId = try? await client.auth.session.user.id else {
            errorMessage = "Your session expired. Sign out and back in."; loadFailed = false; return nil
        }
        struct Insert: Encodable { let user_id: UUID; let kind: String }
        do {
            let created: [ChatThread] = try await client.from("chat_threads")
                .insert(Insert(user_id: userId, kind: "full"))
                .select("id, title, updated_at, kind")
                .execute().value
            await load()
            return created.first?.id
        } catch {
            errorMessage = "Couldn't start a new chat. " + friendlyError(error.localizedDescription)
            loadFailed = false
            return nil
        }
    }

    func delete(_ id: UUID) async {
        do {
            try await client.from("chat_threads").delete().eq("id", value: id).execute()
        } catch {
            errorMessage = "Couldn't delete that chat. Check your connection and try again."
            loadFailed = false
        }
        await load()
    }
}

struct ChatThreadListView: View {
    @Environment(CoachBubbleVisibility.self) private var coachVisibility: CoachBubbleVisibility?
    @State private var vm = ChatThreadListVM()
    @State private var newThreadId: UUID?
    @State private var pushNew = false

    var body: some View {
        List {
            if let err = vm.errorMessage {
                ErrorBanner(message: err,
                            onRetry: vm.loadFailed ? { Task { await vm.load() } } : nil,
                            onDismiss: { vm.errorMessage = nil })
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if vm.threads.isEmpty {
                if vm.isLoading && !vm.hasLoaded {
                    ProgressView().frame(maxWidth: .infinity)
                } else if !vm.loadFailed {
                    Text("No chats yet. Tap the pencil to start one.")
                        .foregroundStyle(Theme.textSecondary).font(Theme.body(.footnote))
                }
            }
            ForEach(vm.threads) { t in
                NavigationLink {
                    ChatView(threadId: t.id)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.title ?? "New chat").lineLimit(1)
                        Text(t.updatedAt.prefix(10)).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    }
                }
                .swipeActions {
                    Button(role: .destructive) { Task { await vm.delete(t.id) } } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .coveForm()
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
        .onAppear { coachVisibility?.isHidden = true }
        .onDisappear { coachVisibility?.isHidden = false }
    }
}
