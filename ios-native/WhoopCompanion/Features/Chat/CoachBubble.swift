import SwiftUI

// MARK: - Visibility env

@Observable
final class CoachBubbleVisibility {
    var isHidden: Bool = false
}

// MARK: - Quick chat VM

@Observable
final class CoachQuickChatVM {
    var threadId: UUID?
    var errorMessage: String?
    var isPromoting = false
    private let client = SupabaseManager.shared.client

    struct ThreadRow: Decodable { let id: UUID }

    func ensureThread() async {
        guard threadId == nil else { return }
        do {
            let existing: [ThreadRow] = try await client.from("chat_threads")
                .select("id")
                .eq("kind", value: "quick")
                .order("updated_at", ascending: false)
                .limit(1)
                .execute().value
            if let row = existing.first {
                threadId = row.id
                return
            }
            guard let userId = try? await client.auth.session.user.id else {
                errorMessage = "Not signed in"; return
            }
            struct Insert: Encodable { let user_id: UUID; let kind: String; let title: String }
            let created: [ThreadRow] = try await client.from("chat_threads")
                .insert(Insert(user_id: userId, kind: "quick", title: "Quick chat"))
                .select("id")
                .execute().value
            threadId = created.first?.id
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func promoteToFull() async -> UUID? {
        guard let id = threadId else { return nil }
        isPromoting = true
        defer { isPromoting = false }
        struct Update: Encodable { let kind: String }
        do {
            _ = try await client.from("chat_threads")
                .update(Update(kind: "full"))
                .eq("id", value: id)
                .execute()
            return id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}

// MARK: - Host (wraps TabView with a floating FAB overlay)

struct CoachBubbleHost<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @State private var visibility = CoachBubbleVisibility()
    @State private var vm = CoachQuickChatVM()
    @State private var showSheet = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content()

            if !visibility.isHidden {
                CoachFAB {
                    Haptics.tap(.light)
                    showSheet = true
                    Task { await vm.ensureThread() }
                }
                .padding(.trailing, 16)
                .padding(.bottom, 76) // clear the tab bar
                .transition(.scale.combined(with: .opacity))
            }
        }
        .environment(visibility)
        .animation(.spring(response: 0.25, dampingFraction: 0.85), value: visibility.isHidden)
        .sheet(isPresented: $showSheet) {
            CoachQuickChatSheet(vm: vm, isPresented: $showSheet)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }
}

// MARK: - FAB

struct CoachFAB: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(Theme.accent)
                    .frame(width: 56, height: 56)
                    .shadow(color: Color.black.opacity(0.25), radius: 10, x: 0, y: 4)
                Image("CoachAvatar")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 44, height: 44)
                    .clipShape(Circle())
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open Coach chat")
    }
}

// MARK: - Quick chat sheet

struct CoachQuickChatSheet: View {
    @Bindable var vm: CoachQuickChatVM
    @Binding var isPresented: Bool

    @ViewBuilder
    private var content: some View {
        if let id = vm.threadId {
            ChatView(threadId: id)
        } else if let err = vm.errorMessage {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle").font(.title)
                Text(err).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }.padding()
        } else {
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    var body: some View {
        NavigationStack {
            content

            .navigationTitle("Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 8) {
                        Image("CoachAvatar")
                            .resizable().scaledToFill()
                            .frame(width: 28, height: 28)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if await vm.promoteToFull() != nil {
                                Haptics.success()
                            }
                            isPresented = false
                        }
                    } label: {
                        Image(systemName: "arrow.up.right.square")
                    }
                    .disabled(vm.threadId == nil || vm.isPromoting)
                    .help("Promote to full chat")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { isPresented = false } label: {
                        Image(systemName: "xmark")
                    }
                }
            }
        }
    }
}
