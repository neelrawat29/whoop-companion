import Foundation
import Observation

@Observable
final class CommunityViewModel {
    var groups: [Group] = []
    var errorMessage: String?
    var newName = ""; var newIcon = "🏆"
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        struct MembershipRow: Decodable { let groups: Group }
        do {
            let rows: [MembershipRow] = try await client.from("group_members")
                .select("groups(*)").eq("user_id", value: userId).execute().value
            groups = rows.map { $0.groups }
        } catch { errorMessage = error.localizedDescription }
    }

    func create() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        struct Insert: Encodable { let name: String; let icon: String?; let created_by: UUID }
        do {
            let created: [Group] = try await client.from("groups")
                .insert(Insert(name: newName, icon: newIcon.isEmpty ? nil : newIcon, created_by: userId))
                .select().execute().value
            if let g = created.first {
                struct Member: Encodable { let group_id: UUID; let user_id: UUID; let role: String }
                _ = try? await client.from("group_members")
                    .insert(Member(group_id: g.id, user_id: userId, role: "owner")).execute()
            }
            newName = ""; await load()
        } catch { errorMessage = error.localizedDescription }
    }

    func join(code: String) async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            let matches: [Group] = try await client.from("groups")
                .select().eq("invite_code", value: code.uppercased()).limit(1).execute().value
            guard let g = matches.first else { errorMessage = "No group with that code"; return }
            struct Member: Encodable { let group_id: UUID; let user_id: UUID; let role: String }
            _ = try? await client.from("group_members")
                .insert(Member(group_id: g.id, user_id: userId, role: "member")).execute()
            await load()
        } catch { errorMessage = error.localizedDescription }
    }
}
