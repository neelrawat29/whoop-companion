import SwiftUI
import Charts

struct InsightsView: View {
    @State private var vm = InsightsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                NavigationLink {
                    BiologicalAgeView()
                } label: {
                    HStack {
                        Label("Biological Age", systemImage: "sparkles")
                            .font(.headline)
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.secondary)
                    }
                    .padding()
                }
                .card()

                NavigationLink {
                    TrendsView()
                } label: {
                    HStack {
                        Label("Trends", systemImage: "chart.line.uptrend.xyaxis")
                            .font(.headline)
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.secondary)
                    }
                    .padding()
                }
                .card()

                if vm.isLoading {
                    ProgressView().padding()
                }
                if !vm.entries.isEmpty {
                    section("Recovery (30d)") {
                        Chart(vm.entries) { e in
                            if let r = e.recovery, let d = DateFormatter.entryDate.date(from: e.entryDate) {
                                LineMark(x: .value("d", d), y: .value("r", r))
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                        .frame(height: 180)
                    }
                    section("Recovery by day of week") {
                        let dow = dayOfWeekAverages(vm.entries)
                        if let (best, worst) = bestWorst(dow) {
                            Text("Best: \(best.day) (\(best.avg!)) · Worst: \(worst.day) (\(worst.avg!))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Chart(dow, id: \.day) { row in
                            BarMark(x: .value("Day", row.day), y: .value("Avg", row.avg ?? 0))
                                .foregroundStyle(color(for: row.avg))
                                .cornerRadius(4)
                        }
                        .chartYScale(domain: 0...100)
                        .frame(height: 180)
                    }
                    section("Sleep hours (30d)") {
                        Chart(vm.entries) { e in
                            if let s = e.sleepHours, let d = DateFormatter.entryDate.date(from: e.entryDate) {
                                BarMark(x: .value("d", d), y: .value("h", s))
                            }
                        }
                        .frame(height: 180)
                    }
                    section("HRV (30d)") {
                        Chart(vm.entries) { e in
                            if let h = e.hrv, let d = DateFormatter.entryDate.date(from: e.entryDate) {
                                LineMark(x: .value("d", d), y: .value("hrv", h))
                            }
                        }
                        .frame(height: 180)
                    }
                } else if !vm.isLoading {
                    Text("Log entries to see insights.").foregroundStyle(.secondary).padding()
                }
            }
            .padding()
        }
        .navigationTitle("Insights")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    @ViewBuilder
    private func section<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
        }
        .card()
    }
}

private struct DowRow { let day: String; let avg: Int?; let n: Int }

private func dayOfWeekAverages(_ entries: [DailyEntry]) -> [DowRow] {
    var sums = Array(repeating: 0, count: 7)
    var counts = Array(repeating: 0, count: 7)
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC") ?? .current
    for e in entries {
        guard let r = e.recovery, let d = DateFormatter.entryDate.date(from: e.entryDate) else { continue }
        let dow = cal.component(.weekday, from: d) - 1 // 0=Sun
        sums[dow] += Int(r)
        counts[dow] += 1
    }
    let labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    let order = [1, 2, 3, 4, 5, 6, 0]
    return order.map { i in
        DowRow(day: labels[i], avg: counts[i] > 0 ? sums[i] / counts[i] : nil, n: counts[i])
    }
}

private func bestWorst(_ rows: [DowRow]) -> (best: DowRow, worst: DowRow)? {
    let valid = rows.compactMap { r -> DowRow? in (r.avg != nil && r.n >= 2) ? r : nil }
    guard valid.count >= 2 else { return nil }
    let best = valid.max(by: { ($0.avg ?? 0) < ($1.avg ?? 0) })!
    let worst = valid.min(by: { ($0.avg ?? 0) < ($1.avg ?? 0) })!
    return (best, worst)
}

private func color(for avg: Int?) -> Color {
    guard let a = avg else { return .gray.opacity(0.3) }
    if a >= 67 { return .green }
    if a >= 34 { return .yellow }
    return .red
}
