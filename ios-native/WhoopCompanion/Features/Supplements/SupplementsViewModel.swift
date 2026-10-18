import Foundation
import Observation

@Observable
final class SupplementsViewModel {
    var items: [UserSupplement] = []
    var stats: [UUID: SupplementStat] = [:]
    /// List-level errors (loading, deleting).
    var errorMessage: String?
    var isLoading = false
    var hasLoaded = false
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else {
            errorMessage = "Your session expired. Sign out and back in."; return
        }
        isLoading = true; defer { isLoading = false; hasLoaded = true }
        do {
            items = try await client.from("user_supplements")
                .select().eq("user_id", value: userId)
                .order("name").execute().value
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't load your supplements. " + friendlyError(error.localizedDescription)
        }
        await loadStats()
    }

    func loadStats() async {
        do {
            let list: [SupplementStat] = try await APIClient.shared.getAPI(path: "supplement-stats")
            var map: [UUID: SupplementStat] = [:]
            for s in list { map[s.id] = s }
            stats = map
        } catch {
            // silent — stats are supplementary
        }
    }

    /// Returns nil on success, or a user-facing error message.
    func add(name: String,
             brand: String?,
             servingSize: String?,
             notes: String?,
             calories: Double? = nil,
             proteinG: Double? = nil,
             carbsG: Double? = nil,
             fatG: Double? = nil,
             timeOfDay: String? = nil) async -> String? {
        guard let userId = try? await client.auth.session.user.id else {
            return "Your session expired. Sign out and back in."
        }
        struct Insert: Encodable {
            let user_id: UUID; let name: String; let brand: String?
            let serving_size: String?; let notes: String?
            let calories: Double?; let protein_g: Double?
            let carbs_g: Double?; let fat_g: Double?
            let time_of_day: String?
        }
        do {
            try await client.from("user_supplements").insert(Insert(
                user_id: userId, name: name, brand: brand,
                serving_size: servingSize, notes: notes,
                calories: calories, protein_g: proteinG,
                carbs_g: carbsG, fat_g: fatG,
                time_of_day: timeOfDay
            )).execute()
            await load()
            return nil
        } catch {
            return "Couldn't save this supplement. " + friendlyError(error.localizedDescription)
        }
    }

    func delete(offsets: IndexSet) async {
        var failed = false
        for i in offsets {
            do {
                try await client.from("user_supplements").delete().eq("id", value: items[i].id).execute()
            } catch { failed = true }
        }
        await load()
        if failed { errorMessage = "Couldn't delete that supplement. Check your connection and try again." }
    }
}
