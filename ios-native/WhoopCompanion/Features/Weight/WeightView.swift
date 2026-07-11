import SwiftUI
import Charts

private enum WeightRange: String, CaseIterable, Identifiable {
    case m1 = "1M", m3 = "3M", m6 = "6M", y1 = "1Y", all = "ALL"
    var id: String { rawValue }
    var days: Int? {
        switch self {
        case .m1: return 30
        case .m3: return 90
        case .m6: return 180
        case .y1: return 365
        case .all: return nil
        }
    }
}

struct WeightView: View {
    @State private var vm = WeightViewModel()
    @State private var profile: Profile?
    @State private var newWeight: Double?
    @State private var newDate: Date = Date()
    @State private var range: WeightRange = .m3

    private let client = SupabaseManager.shared.client

    private var unit: String { profile?.weightUnit ?? "kg" }
    private func toDisplay(_ kg: Double) -> Double { unit == "lbs" ? kg * 2.20462 : kg }
    private func fromDisplay(_ v: Double) -> Double { unit == "lbs" ? v / 2.20462 : v }
    private func fmt(_ kg: Double) -> String {
        String(format: "%.1f %@", toDisplay(kg), unit)
    }

    private var filtered: [WeightEntry] {
        guard let days = range.days else { return vm.entries }
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return vm.entries.filter { ($0.parsedDate ?? Date.distantPast) >= cutoff }
    }

    private var latest: WeightEntry? { vm.entries.last }
    private var delta7: Double? { deltaKg(daysAgo: 7) }
    private var delta30: Double? { deltaKg(daysAgo: 30) }

    private func deltaKg(daysAgo: Int) -> Double? {
        guard let latest = latest, let latestDate = latest.parsedDate else { return nil }
        let target = Calendar.current.date(byAdding: .day, value: -daysAgo, to: latestDate) ?? latestDate
        let past = vm.entries.reversed().first { ($0.parsedDate ?? Date.distantFuture) <= target }
        guard let p = past else { return nil }
        return latest.weightKg - p.weightKg
    }

    private var bmi: Double? {
        guard let latest = latest, let h = profile?.heightCm, h > 0 else { return nil }
        let m = h / 100.0
        return latest.weightKg / (m * m)
    }

    var body: some View {
        List {
            Section("Add entry") {
                DatePicker("Date", selection: $newDate, displayedComponents: .date)
                HStack {
                    Text("Weight (\(unit))")
                    Spacer()
                    TextField("—", value: $newWeight, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 100)
                }
                Button("Add") {
                    Task {
                        if let w = newWeight {
                            await vm.add(weightKg: fromDisplay(w), date: newDate)
                            newWeight = nil
                            Haptics.success()
                        }
                    }
                }
                .disabled(newWeight == nil)
            }

            if let l = latest {
                Section("Stats") {
                    LabeledContent("Latest", value: fmt(l.weightKg))
                    if let d = delta7 { LabeledContent("7-day change", value: signedDelta(d)) }
                    if let d = delta30 { LabeledContent("30-day change", value: signedDelta(d)) }
                    if let goal = profile?.weightGoalKg {
                        LabeledContent("Goal", value: fmt(goal))
                        let togo = l.weightKg - goal
                        LabeledContent("To goal", value: signedDelta(-togo))
                    }
                    if let b = bmi {
                        LabeledContent("BMI", value: String(format: "%.1f", b))
                    }
                }
            }

            Section {
                Picker("Range", selection: $range) {
                    ForEach(WeightRange.allCases) { r in Text(r.rawValue).tag(r) }
                }
                .pickerStyle(.segmented)

                if filtered.isEmpty {
                    Text("No entries in this range").foregroundStyle(.secondary)
                } else {
                    Chart(filtered) { entry in
                        LineMark(
                            x: .value("Date", entry.parsedDate ?? Date()),
                            y: .value(unit, toDisplay(entry.weightKg))
                        )
                        .interpolationMethod(.monotone)
                        PointMark(
                            x: .value("Date", entry.parsedDate ?? Date()),
                            y: .value(unit, toDisplay(entry.weightKg))
                        )
                    }
                    .frame(height: 220)
                }
            } header: {
                Text("Trend")
            }

            Section("History") {
                ForEach(vm.entries.reversed()) { e in
                    HStack {
                        Text(e.entryDate)
                        Spacer()
                        Text(fmt(e.weightKg))
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete { offsets in
                    // reversed list — remap
                    let mapped = IndexSet(offsets.map { vm.entries.count - 1 - $0 })
                    Task { await vm.delete(indices: mapped) }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .navigationTitle("Weight")

        .task {
            await vm.load()
            await loadProfile()
        }
        .refreshable {
            await vm.load()
            await loadProfile()
        }
    }

    private func signedDelta(_ kg: Double) -> String {
        let v = toDisplay(kg)
        let sign = v > 0 ? "+" : ""
        return String(format: "%@%.1f %@", sign, v, unit)
    }

    private func loadProfile() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            let p: Profile = try await client.from("profiles")
                .select().eq("id", value: userId).single().execute().value
            profile = p
        } catch { }
    }
}

extension WeightEntry {
    var parsedDate: Date? { DateFormatter.entryDate.date(from: entryDate) }
}
