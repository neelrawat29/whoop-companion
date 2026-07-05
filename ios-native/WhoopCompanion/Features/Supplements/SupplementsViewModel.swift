import Foundation
import Observation

@Observable
final class SupplementsViewModel {
    var items: [UserSupplement] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            items = try await client.from("user_supplements")
                .select().eq("user_id", value: userId)
                .order("name").execute().value
        } catch { errorMessage = error.localizedDescription }
    }

    func add(name: String,
             brand: String?,
             servingSize: String?,
             notes: String?,
             calories: Double? = nil,
             proteinG: Double? = nil,
             carbsG: Double? = nil,
             fatG: Double? = nil) async {
        guard let userId = try? await client.auth.session.user.id else { return }
        struct Insert: Encodable {
            let user_id: UUID; let name: String; let brand: String?
            let serving_size: String?; let notes: String?
            let calories: Double?; let protein_g: Double?
            let carbs_g: Double?; let fat_g: Double?
        }
        do {
            try await client.from("user_supplements").insert(Insert(
                user_id: userId, name: name, brand: brand,
                serving_size: servingSize, notes: notes,
                calories: calories, protein_g: proteinG,
                carbs_g: carbsG, fat_g: fatG
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
