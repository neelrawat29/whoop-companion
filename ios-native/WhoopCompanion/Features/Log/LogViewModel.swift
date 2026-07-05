import Foundation
import Observation

@Observable
final class LogViewModel {
    var date: Date = Date()

    // Morning
    var recovery: Double?
    var hrv: Double?
    var rhr: Double?
    var sleepHours: Double?
    var sleepScore: Double?

    // Evening / habits
    var energy: Int = 5
    var mood: Int = 5
    var hydration: Double?
    var drinks: Int = 0
    var strain: Double?
    var note: String = ""
    var hasBedtime: Bool = false
    var bedtime: Date = Calendar.current.date(bySettingHour: 22, minute: 30, second: 0, of: Date()) ?? Date()
    var hasWakeTime: Bool = false
    var wakeTime: Date = Calendar.current.date(bySettingHour: 6, minute: 30, second: 0, of: Date()) ?? Date()
    var workLocation: String = ""  // "", "home", "office", "off"

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
                strain = h.strain
                note = h.note ?? ""
                workLocation = h.workLocation ?? ""
                if let t = h.bedtime, let d = Self.parseTime(t) {
                    bedtime = d; hasBedtime = true
                } else { hasBedtime = false }
                if let t = h.wakeTime, let d = Self.parseTime(t) {
                    wakeTime = d; hasWakeTime = true
                } else { hasWakeTime = false }
            } else {
                energy = 5; mood = 5; hydration = nil; drinks = 0; strain = nil
                note = ""; workLocation = ""
                hasBedtime = false; hasWakeTime = false
            }
        } catch {
            status = "Load failed: \(error.localizedDescription)"
        }
    }

    private static func parseTime(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        if let d = f.date(from: s) { return d }
        f.dateFormat = "HH:mm"
        return f.date(from: s)
    }

    private static func formatTime(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: d)
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
            let strain: Double?
            let note: String
            let bedtime: String?
            let wake_time: String?
            let work_location: String?
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
                strain: strain,
                note: note,
                bedtime: hasBedtime ? Self.formatTime(bedtime) : nil,
                wake_time: hasWakeTime ? Self.formatTime(wakeTime) : nil,
                work_location: workLocation.isEmpty ? nil : workLocation
            ), onConflict: "user_id,entry_date").execute()

            status = "Saved ✓"
        } catch {
            status = "Save failed: \(error.localizedDescription)"
        }
    }
}
