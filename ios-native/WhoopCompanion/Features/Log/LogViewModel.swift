import Foundation
import Observation

@Observable
final class LogViewModel {
    var date: Date = TodayDate.appDay()

    // Morning
    var recovery: Double?
    var hrv: Double?
    var rhr: Double?
    var sleepHours: Double?
    var sleepScore: Double?

    // Evening / habits
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
    /// Profile bits for the water target.
    var weightKg: Double?
    var sex: String?
    /// Banner text after metrics were pre-filled from Apple Health.
    var healthBanner: String?

    var waterTarget: WaterTarget { WaterTarget.compute(weightKg: weightKg, sex: sex, strain: strain) }
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
            struct P: Decodable { let weight_kg: Double?; let sex: String? }
            if let p: P = try? await client.from("profiles").select("weight_kg,sex")
                .eq("id", value: userId).single().execute().value {
                weightKg = p.weight_kg; sex = p.sex
            }
            let habits: [HabitsLog] = try await client.from("habits_log")
                .select().eq("user_id", value: userId).eq("entry_date", value: dateStr).limit(1).execute().value
            if let h = habits.first {
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
                hydration = nil; drinks = 0; strain = nil
                note = ""; workLocation = ""
                hasBedtime = false; hasWakeTime = false
            }
            await autofillFromHealth()
        } catch {
            status = "Load failed: \(error.localizedDescription)"
        }
    }

    /// Fills empty HRV / RHR / sleep / water fields from Apple Health (never overwrites).
    @MainActor
    func autofillFromHealth() async {
        healthBanner = nil
        let hk = HealthKitManager.shared
        guard hk.isAvailable else { return }
        _ = await hk.requestAuthorization()
        let snap = await hk.snapshot(for: date)
        var filled: [String] = []
        if sleepHours == nil, let v = snap.sleepHours {
            sleepHours = (v * 10).rounded() / 10; filled.append(String(format: "Sleep %.1fh", sleepHours!))
        }
        if hrv == nil, let v = snap.hrvMs { hrv = v.rounded(); filled.append("HRV \(Int(hrv!)) ms") }
        if rhr == nil, let v = snap.rhrBpm { rhr = v.rounded(); filled.append("RHR \(Int(rhr!)) bpm") }
        if (hydration ?? 0) == 0, let v = snap.waterMl, v > 0 {
            hydration = v.rounded(); filled.append("Water \(Int(v)) ml")
        }
        if !filled.isEmpty {
            healthBanner = "Synced \(filled.count) from Apple Health (\(filled.joined(separator: ", "))). Review and tap Save."
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
            let hydration: Int?; let drinks: Int
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
                hydration: hydration.map { Int($0.rounded()) }, drinks: drinks,
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
