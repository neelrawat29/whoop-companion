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
                            Text("Best: \(best.day) (\(best.avg)%) · Worst: \(worst.day) (\(worst.avg)%)")
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
