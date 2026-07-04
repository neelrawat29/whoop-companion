import Foundation
import Observation

@Observable
final class MealsViewModel {
    var date: Date = Date()
    var meals: [Meal] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            meals = try await client.from("meals")
                .select()
                .eq("user_id", value: userId)
                .eq("entry_date", value: date.entryDateString)
                .order("slot").execute().value
        } catch { errorMessage = error.localizedDescription }
    }

    func add(slot: String, description: String, kcal: Double?) async {
        guard let userId = try? await client.auth.session.user.id else { return }
        struct Insert: Encodable {
            let user_id: UUID; let entry_date: String; let slot: String
            let description: String; let kcal: Double?; let source: String
        }
        do {
            try await client.from("meals").insert(Insert(
                user_id: userId, entry_date: date.entryDateString, slot: slot,
                description: description, kcal: kcal, source: "manual"
            )).execute()
            await load()
        } catch { errorMessage = error.localizedDescription }
    }

    func delete(slot: String, offsets: IndexSet) async {
        let items = meals.filter { $0.slot == slot }
        for i in offsets {
            _ = try? await client.from("meals").delete().eq("id", value: items[i].id).execute()
        }
        await load()
    }
}
