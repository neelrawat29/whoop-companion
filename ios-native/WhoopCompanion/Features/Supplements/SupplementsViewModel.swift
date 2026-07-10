import Foundation
import Observation

@Observable
final class SupplementsViewModel {
    var items: [UserSupplement] = []
    var stats: [UUID: SupplementStat] = [:]
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            items = try await client.from("user_supplements")
                .select().eq("user_id", value: userId)
                .order("name").execute().value
        } catch { errorMessage = error.localizedDescription }
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

    func add(name: String,
             brand: String?,
             servingSize: String?,
             notes: String?,
             calories: Double? = nil,
             proteinG: Double? = nil,
             carbsG: Double? = nil,
             fatG: Double? = nil,
             timeOfDay: String? = nil) async {
        guard let userId = try? await client.auth.session.user.id else { return }
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
        } catch { errorMessage = error.localizedDescription }
    }

    func delete(offsets: IndexSet) async {
        for i in offsets {
            _ = try? await client.from("user_supplements").delete().eq("id", value: items[i].id).execute()
        }
        await load()
    }
}
