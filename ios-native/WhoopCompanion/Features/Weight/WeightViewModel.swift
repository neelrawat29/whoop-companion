import Foundation
import Observation

@Observable
final class WeightViewModel {
    var entries: [WeightEntry] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            entries = try await client.from("weight_entries")
                .select().eq("user_id", value: userId)
                .order("entry_date", ascending: true)
                .execute().value
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func add(weightKg: Double, date: Date) async {
        guard let userId = try? await client.auth.session.user.id else { return }
        struct Upsert: Encodable {
            let user_id: UUID; let entry_date: String; let weight_kg: Double
        }
        do {
            try await client.from("weight_entries").upsert(
                Upsert(user_id: userId, entry_date: date.entryDateString, weight_kg: weightKg),
                onConflict: "user_id,entry_date"
            ).execute()
            await load()
        } catch { errorMessage = error.localizedDescription }
    }

    func delete(indices: IndexSet) async {
        for i in indices {
            let e = entries[i]
            _ = try? await client.from("weight_entries").delete().eq("id", value: e.id).execute()
        }
        await load()
    }
}
