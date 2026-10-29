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
    /// Apple Health values not yet in today's log (nil when nothing to offer).
    var healthOffer: HealthKitManager.DailySnapshot?
    var isSyncingHealth = false
    var pins: [PinnedInsight] = []

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

    /// Pulls the latest data from WHOOP (no-op if not connected or offline).
    func syncWhoop() async {
        struct B: Encodable { let action = "sync" }
        struct R: Decodable { let days: Int }
        _ = try? await APIClient.shared.callAPI(path: "whoop", body: B(), as: R.self)
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
            await loadPins()
            await refreshHealthOffer()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadPins() async {
        if let p = try? await PinnedInsightsStore.load() { pins = p }
    }

    func unpin(_ p: PinnedInsight) async -> Bool {
        do {
            try await PinnedInsightsStore.unpin(id: p.id)
            pins.removeAll { $0.id == p.id }
            return true
        } catch { return false }
    }

    var waterTarget: WaterTarget {
        WaterTarget.compute(weightKg: profile?.weightKg, sex: profile?.sex, strain: habits?.strain)
    }

    var isAddingWater = false

    /// Adds `ml` to today's hydration (stored in ml). Re-reads the saved value first so
    /// rapid taps or edits made on another device are never overwritten.
    func addWater(_ ml: Int) async -> Bool {
        guard !isAddingWater, ml > 0 else { return false }
        isAddingWater = true
        defer { isAddingWater = false }
        guard let userId = try? await client.auth.session.user.id else { return false }
        let day = Date().entryDateString
        struct Row: Decodable { let hydration: Double? }
        struct Up: Encodable { let user_id: UUID; let entry_date: String; let hydration: Int }
        do {
            let rows: [Row] = try await client.from("habits_log").select("hydration")
                .eq("user_id", value: userId).eq("entry_date", value: day).limit(1).execute().value
            let saved = Int(rows.first?.hydration ?? 0)
            let next = saved + ml
            try await client.from("habits_log").upsert(
                Up(user_id: userId, entry_date: day, hydration: next),
                onConflict: "user_id,entry_date").execute()
            if habits != nil { habits?.hydration = Double(next) } else { await load() }
            return true
        } catch { errorMessage = error.localizedDescription; return false }
    }

    @MainActor
    func refreshHealthOffer() async {
        let hk = HealthKitManager.shared
        guard hk.isAvailable else { healthOffer = nil; return }
        _ = await hk.requestAuthorization()
        let snap = await hk.snapshot(for: Date())
        var offer = HealthKitManager.DailySnapshot()
        if entry?.hrv == nil { offer.hrvMs = snap.hrvMs }
        if entry?.rhr == nil { offer.rhrBpm = snap.rhrBpm }
        if entry?.sleepHours == nil { offer.sleepHours = snap.sleepHours }
        let has = offer.hrvMs != nil || offer.rhrBpm != nil || offer.sleepHours != nil
        healthOffer = has ? offer : nil
    }

    /// Writes the offered Apple Health metrics into today's entry (only empty fields).
    func acceptHealthOffer() async -> Bool {
        guard let offer = healthOffer, let userId = try? await client.auth.session.user.id else { return false }
        isSyncingHealth = true
        defer { isSyncingHealth = false }
        struct Up: Encodable {
            let user_id: UUID; let entry_date: String
            let hrv: Double?; let rhr: Double?; let sleep_hours: Double?
        }
        do {
            try await client.from("daily_entries").upsert(Up(
                user_id: userId, entry_date: Date().entryDateString,
                hrv: offer.hrvMs.map { $0.rounded() },
                rhr: offer.rhrBpm.map { $0.rounded() },
                sleep_hours: offer.sleepHours.map { ($0 * 10).rounded() / 10 }
            ), onConflict: "user_id,entry_date").execute()
            healthOffer = nil
            await load()
            return true
        } catch { errorMessage = error.localizedDescription; return false }
    }
}
