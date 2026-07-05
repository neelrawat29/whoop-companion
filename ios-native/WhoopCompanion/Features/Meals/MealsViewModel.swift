import Foundation
import Observation

@Observable
final class MealsViewModel {
    var date: Date = Date()
    var meals: [Meal] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    var totalKcal: Double { meals.reduce(0) { $0 + ($1.kcal ?? 0) } }
    var totalProtein: Double { meals.reduce(0) { $0 + ($1.proteinG ?? 0) } }
    var totalCarbs: Double { meals.reduce(0) { $0 + ($1.carbsG ?? 0) } }
    var totalFat: Double { meals.reduce(0) { $0 + ($1.fatG ?? 0) } }

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            meals = try await client.from("meals")
                .select()
                .eq("user_id", value: userId)
                .eq("entry_date", value: date.entryDateString)
                .order("created_at").execute().value
        } catch { errorMessage = error.localizedDescription }
    }

    func meal(for slot: String) -> Meal? { meals.first { $0.slot == slot } }
    func snacks() -> [Meal] { meals.filter { $0.slot == "snack" } }

    struct Upsert: Encodable {
        var id: UUID?
        let user_id: UUID
        let entry_date: String
        let slot: String
        let description: String
        let kcal: Double?
        let protein_g: Double?
        let carbs_g: Double?
        let fat_g: Double?
        let source: String
    }

    @discardableResult
    func save(id: UUID?, slot: String, description: String,
              kcal: Double?, protein: Double?, carbs: Double?, fat: Double?,
              source: String) async -> Bool {
        guard let userId = try? await client.auth.session.user.id else { return false }
        do {
            if let id {
                struct Update: Encodable {
                    let description: String
                    let kcal: Double?; let protein_g: Double?
                    let carbs_g: Double?; let fat_g: Double?
                    let source: String
                }
                try await client.from("meals")
                    .update(Update(description: description, kcal: kcal,
                                   protein_g: protein, carbs_g: carbs, fat_g: fat,
                                   source: source))
                    .eq("id", value: id).execute()
            } else {
                struct Insert: Encodable {
                    let user_id: UUID
                    let entry_date: String
                    let slot: String
                    let description: String
                    let kcal: Double?; let protein_g: Double?
                    let carbs_g: Double?; let fat_g: Double?
                    let source: String
                }
                try await client.from("meals").insert(Insert(
                    user_id: userId,
                    entry_date: date.entryDateString,
                    slot: slot,
                    description: description,
                    kcal: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat,
                    source: source
                )).execute()
            }
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func addEmptySnack() async {
        _ = await save(id: nil, slot: "snack", description: "",
                       kcal: nil, protein: nil, carbs: nil, fat: nil, source: "manual")
    }

    func delete(id: UUID) async {
        _ = try? await client.from("meals").delete().eq("id", value: id).execute()
        await load()
    }
}

// MARK: - AI Estimate

struct MealEstimate: Decodable {
    let kcal: Double?
    let protein_g: Double?
    let carbs_g: Double?
    let fat_g: Double?
    let confidence: Double?
    let assumptions: String?
}

enum MealEstimator {
    struct RequestBody: Encodable {
        let data: Payload
        struct Payload: Encodable {
            let description: String
            let portionNotes: String
            let userKcalHint: Int?
        }
    }

    static func estimate(description: String, portionNotes: String, userKcalHint: Int?) async throws -> MealEstimate {
        let body = RequestBody(data: .init(
            description: description,
            portionNotes: portionNotes,
            userKcalHint: userKcalHint
        ))
        return try await APIClient.shared.callServerFn(name: "estimateMeal", body: body)
    }
}
