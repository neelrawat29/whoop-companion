import Foundation
import Observation

enum InsightMetric: String, CaseIterable, Identifiable {
    case recovery = "Recovery", sleep = "Sleep", strain = "Strain"
    var id: String { rawValue }
    var unit: String { self == .recovery ? "%" : self == .sleep ? "" : "" }
    var icon: String { self == .recovery ? "heart.fill" : self == .sleep ? "bed.double.fill" : "flame.fill" }
    var maxY: Double { self == .recovery ? 100 : self == .sleep ? 12 : 21 }
    func format(_ v: Double) -> String {
        switch self {
        case .recovery: return "\(Int(v.rounded()))%"
        case .sleep:
            let mins = Int((v * 60).rounded())
            return "\(mins / 60) hr \(mins % 60) min"
        case .strain: return String(format: "%.1f", v)
        }
    }
}

struct InsightPoint: Identifiable {
    let dateString: String
    let date: Date
    var recovery: Double?
    var sleep: Double?
    var strain: Double?
    var id: String { dateString }
    func value(_ m: InsightMetric) -> Double? {
        switch m { case .recovery: recovery; case .sleep: sleep; case .strain: strain }
    }
}

@Observable
final class InsightsViewModel {
    var points: [InsightPoint] = []
    var isLoading = false
    var errorMessage: String?
    var habitInsights: HabitInsightsResponse?
    var habitLoading = false
    var habitFailed = false
    var weekly: WeeklySummaryResponse?
    var weeklyLoading = false
    var weeklyFailed = false
    var baselines: BaselinesResponse?
    var baselinesLoading = false
    var baselinesFailed = false
    var pins: [PinnedInsight] = []
    var pinBusy = false
    var pinError: String?

    private let client = SupabaseManager.shared.client

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            async let e: [DailyEntry] = client.from("daily_entries").select()
                .eq("user_id", value: userId).order("entry_date", ascending: true).execute().value
            async let h: [HabitsLog] = client.from("habits_log").select()
                .eq("user_id", value: userId).order("entry_date", ascending: true).execute().value
            let (entries, habits) = try await (e, h)
            var map: [String: InsightPoint] = [:]
            func point(_ ds: String) -> InsightPoint? {
                if let p = map[ds] { return p }
                guard let d = DateFormatter.entryDate.date(from: ds) else { return nil }
                return InsightPoint(dateString: ds, date: d)
            }
            for x in entries {
                guard var p = point(x.entryDate) else { continue }
                p.recovery = x.recovery; p.sleep = x.sleepHours; map[x.entryDate] = p
            }
            for x in habits where x.strain != nil {
                guard var p = point(x.entryDate) else { continue }
                p.strain = x.strain; map[x.entryDate] = p
            }
            points = map.values.sorted { $0.date < $1.date }
        } catch { errorMessage = error.localizedDescription }
    }

    func loadWeekly() async {
        weeklyLoading = true
        defer { weeklyLoading = false }
        do {
            weekly = try await APIClient.shared.getAPI(path: "weekly-summary", as: WeeklySummaryResponse.self)
            weeklyFailed = false
        } catch {
            weeklyFailed = true
        }
    }

    func loadBaselines() async {
        baselinesLoading = true
        defer { baselinesLoading = false }
        do {
            baselines = try await APIClient.shared.getAPI(path: "baselines", as: BaselinesResponse.self)
            baselinesFailed = false
        } catch {
            baselinesFailed = true
        }
    }

    func loadHabitInsights() async {
        habitLoading = true
        defer { habitLoading = false }
        do {
            habitInsights = try await APIClient.shared.getAPI(path: "habit-insights", as: HabitInsightsResponse.self)
            habitFailed = false
            await loadPins()
            if let findings = habitInsights?.findings {
                await PinnedInsightsStore.refresh(pins, with: findings)
            }
        } catch {
            habitFailed = true
        }
    }

    var pinnedFindingIds: Set<String> {
        Set((habitInsights?.findings ?? []).filter { f in pins.contains { $0.source == PinnedInsightsStore.source(for: f.id) } }.map(\.id))
    }

    func loadPins() async {
        if let p = try? await PinnedInsightsStore.load() { pins = p }
    }

    /// Pins or unpins a finding; returns the toast text on success.
    func togglePin(_ f: HabitFinding) async -> String? {
        guard !pinBusy else { return nil }
        pinBusy = true
        defer { pinBusy = false }
        let src = PinnedInsightsStore.source(for: f.id)
        do {
            if let existing = pins.first(where: { $0.source == src }) {
                try await PinnedInsightsStore.unpin(id: existing.id)
                await loadPins()
                return "Unpinned from Today"
            } else {
                try await PinnedInsightsStore.pin(f)
                await loadPins()
                return "Pinned to Today"
            }
        } catch {
            pinError = "Couldn't update pin. Try again."
            return nil
        }
    }

    /// Average over the last `days` calendar days (nil = all time).
    func average(_ m: InsightMetric, days: Int?) -> Double? {
        let cutoff = days.flatMap { Calendar.current.date(byAdding: .day, value: -($0 - 1), to: Calendar.current.startOfDay(for: TodayDate.appDay())) }
        let vals = points.filter { cutoff == nil || $0.date >= cutoff! }.compactMap { $0.value(m) }
        return vals.isEmpty ? nil : vals.reduce(0, +) / Double(vals.count)
    }

    func trend(_ m: InsightMetric, days: Int = 30) -> [InsightPoint] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -(days - 1), to: Calendar.current.startOfDay(for: TodayDate.appDay()))!
        return points.filter { $0.date >= cutoff && $0.value(m) != nil }
    }

    /// Last 28 calendar days, grouped by weekday (Mon first).
    func weekday(_ m: InsightMetric) -> [WeekdayRow] {
        let recent = trend(m, days: 28)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        let labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return [1, 2, 3, 4, 5, 6, 0].map { i in
            let items = recent.filter { cal.component(.weekday, from: $0.date) - 1 == i }
            let vals = items.compactMap { $0.value(m) }
            return WeekdayRow(day: labels[i], avg: vals.isEmpty ? nil : vals.reduce(0, +) / Double(vals.count),
                              items: items.sorted { $0.date > $1.date })
        }
    }
}

struct WeekdayRow: Identifiable {
    let day: String
    let avg: Double?
    let items: [InsightPoint]
    var id: String { day }
}
