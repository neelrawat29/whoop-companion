import SwiftUI

struct HomeView: View {
    @State private var vm = HomeViewModel()
    @State private var showRecap = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                if missingCount >= 2 {
                    Button { showRecap = true } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "sparkles").font(.title3).foregroundStyle(Theme.accent)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("End-of-day recap ready").font(.subheadline.weight(.semibold))
                                Text("\(missingCount) things left — fill in one screen.").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(Theme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                                .strokeBorder(Theme.accent.opacity(0.3), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                recommendationCard

                ringsCard

                habitsCard

                supplementsCard

                mealsCard
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Today")
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .sheet(isPresented: $showRecap) {
            RecapView(onFinished: { Task { await vm.load() } })
        }
    }

    private var missingCount: Int {
        var n = 0
        if vm.entry?.recovery == nil { n += 1 }
        let slots = Set(vm.meals.map { $0.slot })
        if !slots.contains("breakfast") { n += 1 }
        if !slots.contains("lunch") { n += 1 }
        if !slots.contains("dinner") { n += 1 }
        if (vm.habits?.hydration ?? 0) == 0 { n += 1 }
        if vm.habits?.energy == nil { n += 1 }
        return n
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !vm.firstName.isEmpty {
                Text("Welcome, \(vm.firstName)").font(.footnote).foregroundStyle(.secondary)
            }
            Text(prettyToday).font(.title.bold())
            Text("Your daily snapshot.").font(.subheadline).foregroundStyle(.secondary)
        }
    }

    private var prettyToday: String {
        let df = DateFormatter()
        df.dateStyle = .full
        return df.string(from: Date())
    }

    private var recommendationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TODAY'S RECOMMENDATION").font(.caption2).foregroundStyle(.secondary)
            Text(recTitle).font(.title2.bold()).foregroundStyle(recColor)
            if let e = vm.entry {
                HStack(spacing: 20) {
                    metric("Recovery", e.recovery.map { "\(Int($0))%" } ?? "—")
                    metric("HRV", e.hrv.map { "\(Int($0)) ms" } ?? "—")
                    metric("RHR", e.rhr.map { "\(Int($0)) bpm" } ?? "—")
                    metric("Sleep", e.sleepHours.map { String(format: "%.1f h", $0) } ?? "—")
                }
                if let yr = vm.yesterday?.recovery, let er = e.recovery {
                    let diff = Int(er - yr)
                    Text("vs yesterday: \(diff > 0 ? "+" : "")\(diff) pts")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .card()
    }

    private var recTitle: String { vm.recommendation()?.label ?? "Log recovery to get today's plan" }
    private var recColor: Color {
        switch vm.recommendation()?.color {
        case "green": return .green
        case "yellow": return .yellow
        case "red": return .red
        default: return Theme.textPrimary
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.title3.weight(.semibold)).monospacedDigit()
        }
    }

    @ViewBuilder private var ringsCard: some View {
        let kcalT = Double(vm.profile?.kcalTarget ?? 0)
        let proT = Double(vm.profile?.proteinTarget ?? 0)
        let sleepT = vm.profile?.sleepTargetHours ?? 0
        let hasAny = kcalT > 0 || proT > 0 || sleepT > 0
        if hasAny {
            VStack(alignment: .leading, spacing: 12) {
                Text("DAILY TARGETS").font(.caption2).foregroundStyle(.secondary)
                HStack(spacing: 18) {
                    ring(label: "Calories", value: vm.totalKcal, target: kcalT, unit: "kcal", color: .orange)
                    ring(label: "Protein", value: vm.totalProtein, target: proT, unit: "g", color: .pink)
                    ring(label: "Sleep", value: vm.entry?.sleepHours ?? 0, target: sleepT, unit: "h", color: .blue)
                }
            }
            .card()
        }
    }

    private func ring(label: String, value: Double, target: Double, unit: String, color: Color) -> some View {
        let pct = target > 0 ? min(1, value / target) : 0
        return VStack(spacing: 6) {
            ZStack {
                Circle().stroke(color.opacity(0.15), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: pct)
                    .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int(pct * 100))%").font(.caption2.weight(.semibold)).monospacedDigit()
            }
            .frame(width: 62, height: 62)
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text("\(Int(value))/\(Int(target)) \(unit)").font(.caption2).monospacedDigit()
        }
        .frame(maxWidth: .infinity)
    }
    private var habitsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Habits", systemImage: "moon")
                    .font(.headline)
                Spacer()
                NavigationLink("Edit") { LogView() }.font(.caption)
            }
            if let h = vm.habits {
                HStack(spacing: 20) {
                    metric("Energy", h.energy.map { "\($0)/10" } ?? "—")
                    metric("Mood", h.mood.map { "\($0)/10" } ?? "—")
                    metric("Drinks", "\(h.drinks ?? 0)")
                    metric("Hydration", h.hydration.map { String(format: "%.1f L", $0) } ?? "—")
                }
                if let n = h.note, !n.isEmpty {
                    Text("\"\(n)\"").font(.footnote).italic().foregroundStyle(.secondary)
                }
            } else {
                Text("Nothing logged yet.").foregroundStyle(.secondary).font(.footnote)
            }
        }
        .card()
    }

    private var supplementsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Supplements", systemImage: "pills")
                    .font(.headline)
                Spacer()
                NavigationLink("Log") { SupplementsView() }.font(.caption)
            }
            let taken = vm.habits?.supplements ?? []
            if vm.suppCount == 0 {
                Text("Add your first supplement to start logging.").foregroundStyle(.secondary).font(.footnote)
            } else if taken.isEmpty {
                Text("\(vm.suppCount) saved · none logged today").foregroundStyle(.secondary).font(.footnote)
            } else {
                Text("\(taken.count) of \(vm.suppCount) taken today").font(.footnote).foregroundStyle(.secondary)
                FlowChips(items: taken)
            }
        }
        .card()
    }

    private var mealsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Meals", systemImage: "fork.knife")
                    .font(.headline)
                Spacer()
                NavigationLink("Log") { MealsView() }.font(.caption)
            }
            if vm.meals.isEmpty {
                Text("No meals logged.").foregroundStyle(.secondary).font(.footnote)
            } else {
                Text("\(Int(vm.totalKcal)) kcal today")
                    .font(.footnote).foregroundStyle(.secondary)
                ForEach([("breakfast", "Breakfast"), ("lunch", "Lunch"), ("dinner", "Dinner"), ("snack", "Snacks")], id: \.0) { slot, label in
                    let items = vm.meals.filter { $0.slot == slot }
                    if !items.isEmpty {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading) {
                                Text(label).font(.subheadline.weight(.medium))
                                Text(items.map { $0.description }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                            Spacer()
                            Text("\(Int(items.reduce(0) { $0 + ($1.kcal ?? 0) })) kcal")
                                .font(.caption.weight(.semibold)).monospacedDigit()
                        }
                        .padding(.vertical, 4)
                        Divider().opacity(0.4)
                    }
                }
            }
        }
        .card()
    }
}

private struct FlowChips: View {
    let items: [String]
    var body: some View {
        // Simple wrapping using LazyVGrid to keep it compact.
        let cols = [GridItem(.adaptive(minimum: 80), spacing: 6)]
        LazyVGrid(columns: cols, alignment: .leading, spacing: 6) {
            ForEach(items, id: \.self) { s in
                Text(s)
                    .font(.caption)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Theme.card, in: Capsule())
            }
        }
    }
}
