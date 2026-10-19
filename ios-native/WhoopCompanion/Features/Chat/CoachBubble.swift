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

// MARK: - Host (gives all navigation stacks real space above bottom controls)

struct CoachBubbleHost<Content: View, BottomControls: View>: View {
    @ViewBuilder var bottomControls: () -> BottomControls
    @ViewBuilder var content: () -> Content
    @State private var visibility = CoachBubbleVisibility()
    @State private var vm = CoachQuickChatVM()
    @State private var showSheet = false
    @State private var keyboardVisible = false

    var body: some View {
        VStack(spacing: 0) {
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if !keyboardVisible {
                VStack(spacing: 0) {
                    if !visibility.isHidden {
                        HStack {
                            Spacer()
                            CoachFAB {
                                Haptics.tap(.light)
                                showSheet = true
                                Task { await vm.ensureThread() }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    bottomControls()
                }
                .background(Theme.background)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardVisible = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardVisible = false }
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
            Circle()
                .fill(Theme.accent)
                .frame(width: 48, height: 48)
                .overlay(
                    Image(systemName: "message.fill")
                        .font(Theme.heading(.title2))
                        .foregroundStyle(Theme.onAccent)
                )
                .shadow(color: Theme.shadow.opacity(0.15), radius: 10, x: 0, y: 4)
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
                Image(systemName: "exclamationmark.triangle").font(Theme.heading(.title))
                Text(err).multilineTextAlignment(.center).foregroundStyle(Theme.textSecondary)
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
                    Image(systemName: "message.fill")
                        .font(Theme.body(.headline))
                        .foregroundStyle(Theme.accent)
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
