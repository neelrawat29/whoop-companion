import Foundation
import Observation

@Observable
final class HomeViewModel {
    var profile: Profile?
    var entry: DailyEntry?
    var yesterday: DailyEntry?
    var habits: HabitsLog?
    var meals: [Meal] = []
    var suppCount: Int = 0
    var isLoading = false
    var errorMessage: String?

    private let client = SupabaseManager.shared.client

    var firstName: String {
        let name = (profile?.displayName ?? "").trimmingCharacters(in: .whitespaces)
        return name.split(separator: " ").first.map(String.init) ?? ""
    }

    var totalKcal: Double { meals.reduce(0) { $0 + ($1.kcal ?? 0) } }
    var totalProtein: Double { meals.reduce(0) { $0 + ($1.proteinG ?? 0) } }

    func recommendation() -> (label: String, color: String)? {
        guard let rec = entry?.recovery else { return nil }
        let push = profile?.thresholdPush ?? 67
        let rest = profile?.thresholdRest ?? 34
        if rec >= push { return ("Push hard", "green") }
        if rec < rest { return ("Rest & recover", "red") }
        return ("Moderate effort", "yellow")
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        guard let userId = try? await client.auth.session.user.id else { return }
        let today = Date().entryDateString
        let yDate: String = {
            let d = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
            return d.entryDateString
        }()

        do {
            async let profiles: [Profile] = client.from("profiles")
                .select().eq("id", value: userId).limit(1).execute().value
            async let entries: [DailyEntry] = client.from("daily_entries")
                .select().eq("user_id", value: userId).eq("entry_date", value: today).limit(1).execute().value
            async let yEntries: [DailyEntry] = client.from("daily_entries")
                .select().eq("user_id", value: userId).eq("entry_date", value: yDate).limit(1).execute().value
            async let habitsRows: [HabitsLog] = client.from("habits_log")
                .select().eq("user_id", value: userId).eq("entry_date", value: today).limit(1).execute().value
            async let mealRows: [Meal] = client.from("meals")
                .select().eq("user_id", value: userId).eq("entry_date", value: today).execute().value
            async let supRows: [UserSupplement] = client.from("user_supplements")
                .select().eq("user_id", value: userId).execute().value

            let (p, e, y, h, m, s) = try await (profiles, entries, yEntries, habitsRows, mealRows, supRows)
            profile = p.first
            entry = e.first
            yesterday = y.first
            habits = h.first
            meals = m
            suppCount = s.count
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
