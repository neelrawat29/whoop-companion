import Foundation
import Observation

@Observable
final class CommunityViewModel {
    var groups: [Group] = []
    var errorMessage: String?
    var createError: String?
    var isLoading = false
    var hasLoaded = false
    var newName = ""; var newIcon = "🏆"
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else {
            errorMessage = "Your session expired. Sign out and back in."; return
        }
        isLoading = true; defer { isLoading = false; hasLoaded = true }
        struct MembershipRow: Decodable { let groups: Group }
        do {
            let rows: [MembershipRow] = try await client.from("group_members")
                .select("groups(*)").eq("user_id", value: userId).execute().value
            groups = rows.map { $0.groups }
            errorMessage = nil
        } catch { errorMessage = "Couldn't load your groups. " + friendlyError(error.localizedDescription) }
    }

    /// Returns true on success so the sheet only closes when the group exists.
    func create() async -> Bool {
        createError = nil
        guard let userId = try? await client.auth.session.user.id else {
            createError = "Your session expired. Sign out and back in."; return false
        }
        struct Insert: Encodable { let name: String; let icon: String?; let created_by: UUID }
        do {
            let created: [Group] = try await client.from("groups")
                .insert(Insert(name: newName, icon: newIcon.isEmpty ? nil : newIcon, created_by: userId))
                .select().execute().value
            if let g = created.first {
                struct Member: Encodable { let group_id: UUID; let user_id: UUID; let role: String }
                try await client.from("group_members")
                    .insert(Member(group_id: g.id, user_id: userId, role: "owner")).execute()
            }
            newName = ""; await load()
            return true
        } catch {
            createError = "Couldn't create the group. " + friendlyError(error.localizedDescription)
            return false
        }
    }

    /// Returns true on success so the code field is only cleared after joining.
    func join(code: String) async -> Bool {
        guard let userId = try? await client.auth.session.user.id else {
            errorMessage = "Your session expired. Sign out and back in."; return false
        }
        do {
            let matches: [Group] = try await client.from("groups")
                .select().eq("invite_code", value: code.uppercased()).limit(1).execute().value
            guard let g = matches.first else {
                errorMessage = "No group uses the code \(code.uppercased()). Check the code and try again."
                return false
            }
            if groups.contains(where: { $0.id == g.id }) {
                errorMessage = "You're already in \(g.name)."
                return false
            }
            struct Member: Encodable { let group_id: UUID; let user_id: UUID; let role: String }
            try await client.from("group_members")
                .insert(Member(group_id: g.id, user_id: userId, role: "member")).execute()
            await load()
            return true
        } catch {
            errorMessage = "Couldn't join the group. " + friendlyError(error.localizedDescription)
            return false
        }
    }
}
