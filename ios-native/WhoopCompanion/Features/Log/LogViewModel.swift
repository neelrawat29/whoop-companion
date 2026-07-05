import Foundation
import Observation

@Observable
final class LogViewModel {
    var date: Date = Date()
    var recovery: Double?
    var hrv: Double?
    var rhr: Double?
    var sleepHours: Double?
    var sleepScore: Double?

    var energy: Int = 5
    var mood: Int = 5
    var hydration: Double?
    var drinks: Int = 0
    var note: String = ""

    var isSaving = false
    var status: String?

    private var client = SupabaseManager.shared.client

    func load() async {
        status = nil
        guard let userId = try? await client.auth.session.user.id else { return }
        let dateStr = date.entryDateString
        do {
            let entries: [DailyEntry] = try await client.from("daily_entries")
                .select().eq("user_id", value: userId).eq("entry_date", value: dateStr).limit(1).execute().value
            if let e = entries.first {
                recovery = e.recovery; hrv = e.hrv; rhr = e.rhr
                sleepHours = e.sleepHours; sleepScore = e.sleepScore
            } else {
                recovery = nil; hrv = nil; rhr = nil; sleepHours = nil; sleepScore = nil
            }
            let habits: [HabitsLog] = try await client.from("habits_log")
                .select().eq("user_id", value: userId).eq("entry_date", value: dateStr).limit(1).execute().value
            if let h = habits.first {
                energy = h.energy ?? 5
                mood = h.mood ?? 5
                hydration = h.hydration
                drinks = h.drinks ?? 0
                note = h.note ?? ""
            } else {
                energy = 5; mood = 5; hydration = nil; drinks = 0; note = ""
            }
        } catch {
            status = "Load failed: \(error.localizedDescription)"
        }
    }

    func save() async {
        isSaving = true
        defer { isSaving = false }
        status = nil
        guard let userId = try? await client.auth.session.user.id else {
            status = "Not signed in"; return
        }
        let dateStr = date.entryDateString
        struct DailyUpsert: Encodable {
            let user_id: UUID; let entry_date: String
            let recovery: Double?; let hrv: Double?; let rhr: Double?
            let sleep_hours: Double?; let sleep_score: Double?
            let source: String
        }
        struct HabitsUpsert: Encodable {
            let user_id: UUID; let entry_date: String
            let energy: Int; let mood: Int
            let hydration: Double?; let drinks: Int
            let note: String
        }
        do {
            try await client.from("daily_entries").upsert(DailyUpsert(
                user_id: userId, entry_date: dateStr,
                recovery: recovery, hrv: hrv, rhr: rhr,
                sleep_hours: sleepHours, sleep_score: sleepScore,
                source: "manual"
            ), onConflict: "user_id,entry_date").execute()

            try await client.from("habits_log").upsert(HabitsUpsert(
                user_id: userId, entry_date: dateStr,
                energy: energy, mood: mood,
                hydration: hydration, drinks: drinks,
                note: note
            ), onConflict: "user_id,entry_date").execute()

            status = "Saved ✓"
        } catch {
            status = "Save failed: \(error.localizedDescription)"
        }
    }
}
