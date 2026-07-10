import Foundation
import Observation

@Observable
final class InsightsViewModel {
    var entries: [DailyEntry] = []
    var isLoading = false
    var errorMessage: String?

    private let client = SupabaseManager.shared.client

    func load() async {
        isLoading = true
        defer { isLoading = false }
        guard let userId = try? await client.auth.session.user.id else { return }
        let cutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date()) ?? Date()
        do {
            entries = try await client.from("daily_entries")
                .select()
                .eq("user_id", value: userId)
                .gte("entry_date", value: cutoff.entryDateString)
                .order("entry_date", ascending: true)
                .execute().value
        } catch { errorMessage = error.localizedDescription }
    }
}
