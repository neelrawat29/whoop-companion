import SwiftUI

struct HomeView: View {
    @State private var vm = HomeViewModel()
    @State private var showRecap = false
    @State private var toast: ToastMessage?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                if let err = vm.errorMessage {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.amber)
                        Text(err).font(Theme.body(.footnote)).frame(maxWidth: .infinity, alignment: .leading)
                        Button("Retry") { Task { vm.errorMessage = nil; await vm.load() } }
                            .font(Theme.body(.footnote).weight(.semibold))
                            .frame(minHeight: 44)
                    }
                    .padding(.horizontal, 12)
                    .background(Theme.amber.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                if missingCount >= 2 {
                    Button { showRecap = true } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "sparkles").font(Theme.heading(.title3)).foregroundStyle(Theme.accent)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("End-of-day recap ready").font(Theme.body(.subheadline).weight(.semibold))
                                Text("\(missingCount) things left — fill in one screen.").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(Theme.textSecondary)
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

                if let offer = vm.healthOffer { healthCard(offer) }

                recommendationCard

                ringsCard

                waterCard

                habitsCard

                supplementsCard

                mealsCard
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .toast($toast)
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.load() }
        .refreshable { await vm.syncWhoop(); await vm.load() }
        .sheet(isPresented: $showRecap) {
            RecapView(onFinished: { Task { await vm.load() } })
        }
    }

    private func healthCard(_ o: HealthKitManager.DailySnapshot) -> some View {
        let parts: [String] = [
            o.sleepHours.map { String(format: "Sleep %.1fh", $0) },
            o.hrvMs.map { "HRV \(Int($0.rounded())) ms" },
            o.rhrBpm.map { "RHR \(Int($0.rounded())) bpm" },
        ].compactMap { $0 }
        return Button {
            Task {
                if await vm.acceptHealthOffer() {
                    Haptics.success()
                    toast = ToastMessage(kind: .success, text: "Synced from Apple Health")
                }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "heart.text.square.fill").font(Theme.heading(.title2)).foregroundStyle(Theme.protein)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Apple Health data ready — tap to log").font(Theme.body(.subheadline).weight(.semibold))
                    Text(parts.joined(separator: " · ")).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if vm.isSyncingHealth { ProgressView() } else {
                    Image(systemName: "arrow.down.circle.fill").foregroundStyle(Theme.accent)
                }
            }
            .card()
        }
        .buttonStyle(.plain)
        .disabled(vm.isSyncingHealth)
    }

    private var waterCard: some View {
        let t = vm.waterTarget
        let current = Int(vm.habits?.hydration ?? 0)
        let remaining = max(0, t.targetMl - current)
        let pct = min(1, Double(current) / Double(t.targetMl))
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label("Water", systemImage: "drop.fill").font(Theme.body(.headline)).foregroundStyle(Theme.water)
                Spacer()
                Text(String(format: "%.2f / %.1f L", Double(current) / 1000, Double(t.targetMl) / 1000))
                    .font(Theme.body(.subheadline).weight(.semibold)).monospacedDigit()
            }
            ProgressView(value: pct).tint(Theme.water)
            Text(t.strainBonusMl > 0
                 ? String(format: "%.1f L base + %d ml for strain", Double(t.baselineMl) / 1000, t.strainBonusMl)
                 : String(format: "%.1f L recommended%@", Double(t.baselineMl) / 1000, vm.profile?.weightKg == nil ? " · add weight in Settings to personalise" : ""))
                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(WaterTarget.quickAdds, id: \.ml) { q in
                        Button("+\(q.ml) ml") { addWater(q.ml) }
                            .buttonStyle(CoveButtonStyle()).controlSize(.regular)
                            .disabled(vm.isAddingWater)
                    }
                    Button(remaining == 0 ? "Target met" : "Hit target") { addWater(remaining) }
                        .buttonStyle(CoveButtonStyle(prominent: true)).controlSize(.regular)
                        .disabled(remaining == 0 || vm.isAddingWater)
                }
            }
        }
        .card()
    }

    private func addWater(_ ml: Int) {
        Haptics.tap()
        Task {
            if await vm.addWater(ml) {
                toast = ToastMessage(kind: .success, text: "+\(ml) ml")
            }
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
        return n
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !vm.firstName.isEmpty {
                Text("Welcome, \(vm.firstName)").font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
            }
            Text(prettyToday).font(Theme.heading(.title))
            Text("Your daily snapshot.").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
        }
    }

    private var prettyToday: String {
        let df = DateFormatter()
        df.dateStyle = .full
        return df.string(from: Date())
    }

    private var recommendationCard: some View {
        let e = vm.entry
        return VStack(alignment: .leading, spacing: 16) {
            // Hero: recovery ring + headline
            HStack(spacing: 16) {
                ZStack {
                    let rec = e?.recovery ?? 0
                    Circle().stroke(recColor.opacity(0.15), lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: min(1, rec / 100))
                        .stroke(recColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text(e?.recovery.map { "\(Int($0))" } ?? "—")
                            .font(Theme.heading(.title)).monospacedDigit()
                        Text("%").font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(width: 84, height: 84)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Recovery").font(Theme.body(.caption).weight(.semibold)).foregroundStyle(Theme.textSecondary)
                    Text(recTitle).font(Theme.body(.headline)).foregroundStyle(recColor)
                        .fixedSize(horizontal: false, vertical: true)
                    if let yr = vm.yesterday?.recovery, let er = e?.recovery {
                        let diff = Int(er - yr)
                        Label("\(diff > 0 ? "+" : "")\(diff) vs yesterday",
                              systemImage: diff >= 0 ? "arrow.up.right" : "arrow.down.right")
                            .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer(minLength: 0)
            }

            // 3×2 metric grid — no squeezed single row.
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                tile("Sleep", e?.sleepHours.map(Self.fmtSleepShort) ?? "—", "moon.stars.fill", Theme.sleep)
                tile("HRV", e?.hrv.map { "\(Int($0)) ms" } ?? "—", "waveform.path.ecg", Theme.recovery)
                tile("RHR", e?.rhr.map { "\(Int($0)) bpm" } ?? "—", "heart.fill", Theme.protein)
                tile("Strain", vm.habits?.strain.map { String(format: "%.1f", $0) } ?? "—", "bolt.fill", Theme.amber)
                tile("Burned", vm.habits?.kcalBurned.map { "\($0)" } ?? "—", "flame.fill", Theme.danger)
                tile("Water", String(format: "%.1f L", (vm.habits?.hydration ?? 0) / 1000), "drop.fill", Theme.water)
            }
        }
        .card()
    }

    private func tile(_ label: String, _ value: String, _ icon: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).font(Theme.body(.footnote).weight(.semibold)).foregroundStyle(color)
            Text(value).font(Theme.heading(.headline)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    /// "7h 12m" — compact form for grid tiles.
    private static func fmtSleepShort(_ hours: Double) -> String {
        let totalMin = Int((hours * 60).rounded())
        return "\(totalMin / 60)h \(totalMin % 60)m"
    }

    /// "3 hr 43 min" instead of "3.7 h".
    private static func fmtSleep(_ hours: Double) -> String {
        let totalMin = Int((hours * 60).rounded())
        let h = totalMin / 60, m = totalMin % 60
        return m == 0 ? "\(h) hr" : "\(h) hr \(m) min"
    }

    private var recTitle: String { vm.recommendation()?.label ?? "Log recovery to get today's plan" }
    private var recColor: Color {
        switch vm.recommendation()?.color {
        case "green": return Theme.recovery
        case "yellow": return Theme.amber
        case "red": return Theme.danger
        default: return Theme.textPrimary
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
            Text(value).font(Theme.heading(.title3)).monospacedDigit()
        }
    }

    @ViewBuilder private var ringsCard: some View {
        let kcalT = Double(vm.profile?.kcalTarget ?? 0)
        let burnT = Double(vm.profile?.kcalBurnTarget ?? vm.profile?.kcalTarget ?? 0)
        let proT = Double(vm.profile?.proteinTarget ?? 0)
        let sleepT = vm.profile?.sleepTargetHours ?? 0
        let hasAny = kcalT > 0 || proT > 0 || sleepT > 0
        if hasAny {
            VStack(alignment: .leading, spacing: 12) {
                Text("DAILY TARGETS").font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 16) {
                    ring(label: "Eaten", value: vm.totalKcal, target: kcalT, unit: "kcal", color: Theme.amber)
                    ring(label: "Burned", value: Double(vm.habits?.kcalBurned ?? 0), target: burnT, unit: "kcal", color: Theme.danger)
                    ring(label: "Protein", value: vm.totalProtein, target: proT, unit: "g", color: Theme.protein)
                    ring(label: "Sleep", value: vm.entry?.sleepHours ?? 0, target: sleepT, unit: "h", color: Theme.sleep)
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
                Text("\(Int(pct * 100))%").font(Theme.body(.caption2).weight(.semibold)).monospacedDigit()
            }
            .frame(width: 56, height: 56)
            Text(label).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
            Text("\(Int(value))/\(Int(target)) \(unit)").font(Theme.body(.caption2)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }
    private var habitsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Habits", systemImage: "moon")
                    .font(Theme.body(.headline))
                Spacer()
                NavigationLink("Edit") { LogView() }.font(Theme.body(.caption))
            }
            if let h = vm.habits {
                HStack(spacing: 20) {
                    metric("Drinks", "\(h.drinks ?? 0)")
                    metric("Hydration", h.hydration.map { String(format: "%.2f L", $0 / 1000) } ?? "—")
                }
                if let n = h.note, !n.isEmpty {
                    Text("\"\(n)\"").font(Theme.body(.footnote)).italic().foregroundStyle(Theme.textSecondary)
                }
            } else {
                Text("Nothing logged yet.").foregroundStyle(Theme.textSecondary).font(Theme.body(.footnote))
            }
        }
        .card()
    }

    private var supplementsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Supplements", systemImage: "pills")
                    .font(Theme.body(.headline))
                Spacer()
                NavigationLink("Log") { SupplementsView() }.font(Theme.body(.caption))
            }
            let taken = vm.habits?.supplements ?? []
            if vm.suppCount == 0 {
                Text("Add your first supplement to start logging.").foregroundStyle(Theme.textSecondary).font(Theme.body(.footnote))
            } else if taken.isEmpty {
                Text("\(vm.suppCount) saved · none logged today").foregroundStyle(Theme.textSecondary).font(Theme.body(.footnote))
            } else {
                Text("\(taken.count) of \(vm.suppCount) taken today").font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
                FlowChips(items: taken)
            }
        }
        .card()
    }

    private var mealsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Meals", systemImage: "fork.knife")
                    .font(Theme.body(.headline))
                Spacer()
                NavigationLink("Log") { MealsView() }.font(Theme.body(.caption))
            }
            if vm.meals.isEmpty {
                Text("No meals logged.").foregroundStyle(Theme.textSecondary).font(Theme.body(.footnote))
            } else {
                Text("\(Int(vm.totalKcal)) kcal today")
                    .font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
                ForEach([("breakfast", "Breakfast"), ("lunch", "Lunch"), ("dinner", "Dinner"), ("snack", "Snacks")], id: \.0) { slot, label in
                    let items = vm.meals.filter { $0.slot == slot }
                    if !items.isEmpty {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading) {
                                Text(label).font(Theme.body(.subheadline).weight(.medium))
                                Text(items.map { $0.description }.joined(separator: " · "))
                                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary).lineLimit(2)
                            }
                            Spacer()
                            Text("\(Int(items.reduce(0) { $0 + ($1.kcal ?? 0) })) kcal")
                                .font(Theme.body(.caption).weight(.semibold)).monospacedDigit()
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
                    .font(Theme.body(.caption))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Theme.card, in: Capsule())
            }
        }
    }
}
