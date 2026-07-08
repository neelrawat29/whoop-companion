import SwiftUI

struct GroupSettingsView: View {
    let group: Group
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var icon: String
    @State private var status: String?
    @State private var busy = false
    @State private var members: [LeaderboardRow] = []
    @State private var currentUserId: UUID?

    init(group: Group) {
        self.group = group
        _name = State(initialValue: group.name)
        _icon = State(initialValue: group.icon ?? "👥")
    }

    private var isOwner: Bool { currentUserId == group.createdBy }

    var body: some View {
        Form {
            Section("Details") {
                HStack {
                    TextField("Icon", text: $icon).frame(width: 60)
                    TextField("Name", text: $name)
                }
                .disabled(!isOwner)
                if isOwner {
                    Button("Save changes") { Task { await rename() } }
                        .disabled(busy || (name == group.name && icon == (group.icon ?? "👥")))
                }
            }

            Section("Invite code") {
                HStack {
                    Text(group.inviteCode).font(.title3.monospaced())
                    Spacer()
                    if isOwner {
                        Button("Regenerate") { Task { await regen() } }.disabled(busy)
                    }
                }
            }

            Section("Members") {
                if members.isEmpty { Text("Loading…").foregroundStyle(.secondary) }
                ForEach(members) { m in
                    HStack {
                        Text(m.displayName + (m.userId == currentUserId ? " (you)" : ""))
                        if m.isOwner { Text("owner").font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        if isOwner && m.userId != currentUserId {
                            Button(role: .destructive) {
                                Task { await removeMember(m.userId) }
                            } label: { Image(systemName: "person.badge.minus") }
                        }
                    }
                }
            }

            Section("Danger zone") {
                if isOwner {
                    Button("Delete group", role: .destructive) { Task { await deleteGroup() } }
                } else {
                    Button("Leave group", role: .destructive) { Task { await leave() } }
                }
            }

            if let s = status {
                Text(s).font(.footnote).foregroundStyle(s.contains("failed") || s.contains("Error") ? .red : .green)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Group settings")
        .task { await load() }
    }

    // MARK: - Actions

    struct EmptyBody: Encodable {}
    struct GroupIdBody: Encodable { let data: Inner; struct Inner: Encodable { let groupId: String } }
    struct RenameBody: Encodable { let data: Inner; struct Inner: Encodable { let groupId: String; let name: String; let icon: String } }
    struct RemoveBody: Encodable { let data: Inner; struct Inner: Encodable { let groupId: String; let userId: String } }
    struct LeaderboardResp: Decodable { let group: GroupInfo; let rows: [LeaderboardRow]; let me: UUID
        struct GroupInfo: Decodable { let id: UUID; let name: String; let invite_code: String; let icon: String?; let created_by: UUID }
    }

    private func load() async {
        do {
            let r: LeaderboardResp = try await APIClient.shared.callServerFn(
                name: "getGroupLeaderboard",
                body: GroupIdBody(data: .init(groupId: group.id.uuidString))
            )
            members = r.rows
            currentUserId = r.me
        } catch { status = error.localizedDescription }
    }

    private func rename() async {
        busy = true; defer { busy = false }
        do {
            struct Ok: Decodable { let ok: Bool? }
            _ = try await APIClient.shared.callServerFn(
                name: "renameGroup",
                body: RenameBody(data: .init(groupId: group.id.uuidString, name: name, icon: icon)),
                as: Ok.self
            )
            status = "Saved ✓"
        } catch { status = "Rename failed: \(error.localizedDescription)" }
    }

    private func regen() async {
        busy = true; defer { busy = false }
        do {
            struct Ok: Decodable { let inviteCode: String? }
            _ = try await APIClient.shared.callServerFn(
                name: "regenerateInviteCode",
                body: GroupIdBody(data: .init(groupId: group.id.uuidString)),
                as: Ok.self
            )
            status = "New code generated. Reopen group to refresh."
        } catch { status = "Regenerate failed: \(error.localizedDescription)" }
    }

    private func removeMember(_ uid: UUID) async {
        busy = true; defer { busy = false }
        do {
            struct Ok: Decodable { let ok: Bool? }
            _ = try await APIClient.shared.callServerFn(
                name: "removeMember",
                body: RemoveBody(data: .init(groupId: group.id.uuidString, userId: uid.uuidString)),
                as: Ok.self
            )
            await load()
        } catch { status = "Remove failed: \(error.localizedDescription)" }
    }

    private func leave() async {
        busy = true; defer { busy = false }
        do {
            struct Ok: Decodable { let ok: Bool? }
            _ = try await APIClient.shared.callServerFn(
                name: "leaveGroup",
                body: GroupIdBody(data: .init(groupId: group.id.uuidString)),
                as: Ok.self
            )
            dismiss()
        } catch { status = "Leave failed: \(error.localizedDescription)" }
    }

    private func deleteGroup() async {
        busy = true; defer { busy = false }
        do {
            struct Ok: Decodable { let ok: Bool? }
            _ = try await APIClient.shared.callServerFn(
                name: "deleteGroup",
                body: GroupIdBody(data: .init(groupId: group.id.uuidString)),
                as: Ok.self
            )
            dismiss()
        } catch { status = "Delete failed: \(error.localizedDescription)" }
    }
}
