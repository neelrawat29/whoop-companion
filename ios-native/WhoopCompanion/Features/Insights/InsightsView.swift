import SwiftUI
import Charts

struct InsightsView: View {
    @State private var vm = InsightsViewModel()
    @State private var metric: InsightMetric = .recovery
    @State private var selectedDay: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                navCard("Biological Age", icon: "sparkles") { BiologicalAgeView() }
                navCard("Trends", icon: "chart.line.uptrend.xyaxis") { TrendsView() }

                Picker("Metric", selection: $metric) {
                    ForEach(InsightMetric.allCases) { m in Label(m.rawValue, systemImage: m.icon).tag(m) }
                }
                .pickerStyle(.segmented)
                .onChange(of: metric) { _, _ in selectedDay = nil; Haptics.tap() }

                if vm.isLoading && vm.points.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding()
                } else if let err = vm.errorMessage, vm.points.isEmpty {
                    ContentUnavailableView {
                        Label("Couldn't load insights", systemImage: "exclamationmark.triangle")
                    } description: { Text(friendlyError(err)) } actions: {
                        Button("Try again") { Task { await vm.load() } }.buttonStyle(.borderedProminent)
                    }
                } else if vm.points.isEmpty {
                    ContentUnavailableView("No insights yet", systemImage: "chart.line.uptrend.xyaxis",
                                           description: Text("Log a few days or connect WHOOP in Settings to see your trends."))
                } else {
                    averages
                    trendCard
                    weekdayCard
                }
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Insights")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var tint: Color {
        switch metric { case .recovery: .green; case .sleep: .indigo; case .strain: .orange }
    }

    // MARK: Averages

    private var averages: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Average \(metric.rawValue.lowercased())\(metric == .sleep ? " per night" : metric == .strain ? " per day" : "")")
                .font(.headline)
            HStack(spacing: 10) {
                avgTile("Last 7 days", vm.average(metric, days: 7))
                avgTile("Last 30 days", vm.average(metric, days: 30))
                avgTile("All time", vm.average(metric, days: nil))
            }
        }
    }

    private func avgTile(_ title: String, _ v: Double?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(v.map(metric.format) ?? "—")
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .foregroundStyle(v == nil ? Color.secondary : tint)
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    // MARK: Trend

    private var trendCard: some View {
        let data = vm.trend(metric)
        return VStack(alignment: .leading, spacing: 8) {
            Text("\(metric.rawValue) — last 30 days").font(.headline)
            if data.isEmpty {
                Text("No \(metric.rawValue.lowercased()) data in the last 30 days.")
                    .font(.subheadline).foregroundStyle(.secondary)
            } else {
                Chart(data) { p in
                    if let v = p.value(metric) {
                        if metric == .sleep {
                            BarMark(x: .value("Date", p.date, unit: .day), y: .value(metric.rawValue, v))
                                .foregroundStyle(tint.gradient).cornerRadius(3)
                        } else {
                            AreaMark(x: .value("Date", p.date, unit: .day), y: .value(metric.rawValue, v))
                                .foregroundStyle(tint.opacity(0.15).gradient)
                            LineMark(x: .value("Date", p.date, unit: .day), y: .value(metric.rawValue, v))
                                .foregroundStyle(tint).interpolationMethod(.catmullRom)
                            PointMark(x: .value("Date", p.date, unit: .day), y: .value(metric.rawValue, v))
                                .foregroundStyle(tint).symbolSize(18)
                        }
                    }
                }
                .chartYScale(domain: 0...metric.maxY)
                .frame(height: 190)
            }
        }
        .card()
    }

    // MARK: Weekday

    private var weekdayCard: some View {
        let rows = vm.weekday(metric)
        let valid = rows.filter { $0.avg != nil }
        let daysWithData = rows.reduce(0) { $0 + $1.items.count }
        return VStack(alignment: .leading, spacing: 8) {
            Text("\(metric.rawValue) by day of week").font(.headline)
            Text("Average for each weekday across the last 28 calendar days (\(daysWithData) day\(daysWithData == 1 ? "" : "s") with data). Tap a bar to see its entries.")
                .font(.caption).foregroundStyle(.secondary)
            if valid.count >= 2, let best = valid.max(by: { $0.avg! < $1.avg! }), let worst = valid.min(by: { $0.avg! < $1.avg! }) {
                let highBest = metric != .strain
                Text("\(highBest ? "Best" : "Highest"): \(best.day) (\(metric.format(best.avg!))) · \(highBest ? "Worst" : "Lowest"): \(worst.day) (\(metric.format(worst.avg!)))")
                    .font(.caption.weight(.medium))
            }
            Chart(rows) { r in
                BarMark(x: .value("Day", r.day), y: .value("Avg", r.avg ?? 0))
                    .foregroundStyle(tint)
                    .opacity(selectedDay == nil || selectedDay == r.day ? 1 : 0.25)
                    .cornerRadius(5)
            }
            .chartYScale(domain: 0...metric.maxY)
            .chartXSelection(value: Binding(
                get: { selectedDay },
                set: { new in
                    guard let new else { return }
                    Haptics.tap()
                    selectedDay = (selectedDay == new) ? nil : new
                }))
            .frame(height: 190)

            if let day = selectedDay, let row = rows.first(where: { $0.day == day }) {
                HStack {
                    Text("\(day) entries").font(.subheadline.weight(.semibold))
                    Spacer()
                    Button("Clear selection") { selectedDay = nil }.font(.caption).buttonStyle(.bordered).controlSize(.small)
                }
                .padding(.top, 4)
                if row.items.isEmpty {
                    Text("No entries on this weekday in the last 28 days.").font(.caption).foregroundStyle(.secondary)
                } else {
                    ForEach(row.items) { p in
                        HStack {
                            Text(p.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))
                                .font(.subheadline)
                            Spacer()
                            Text(p.value(metric).map(metric.format) ?? "—")
                                .font(.subheadline.weight(.semibold)).foregroundStyle(tint)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .card()
    }

    private func navCard<D: View>(_ title: String, icon: String, @ViewBuilder destination: @escaping () -> D) -> some View {
        NavigationLink(destination: destination) {
            HStack {
                Label(title, systemImage: icon).font(.headline)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding()
        }
        .card()
    }
}
