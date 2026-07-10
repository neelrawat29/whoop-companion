import SwiftUI
import Charts

struct TrendsView: View {
    @State private var range: Int = 30
    @State private var data: TrendsResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Range", selection: $range) {
                    Text("7d").tag(7)
                    Text("30d").tag(30)
                    Text("90d").tag(90)
                }
                .pickerStyle(.segmented)
                .onChange(of: range) { _, _ in Task { await load() } }

                if isLoading && data == nil {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                }
                if let msg = errorMessage {
                    Text(msg).font(.footnote).foregroundStyle(.red)
                }
                if let d = data {
                    trendCard("Recovery", unit: "%", avg: d.averages.recovery, values: d.points.map { ($0.date, $0.recovery) }, color: .accentColor)
                    trendCard("HRV", unit: "ms", avg: d.averages.hrv, values: d.points.map { ($0.date, $0.hrv) }, color: .green)
                    trendCard("Sleep", unit: "h", avg: d.averages.sleepHours, values: d.points.map { ($0.date, $0.sleepHours) }, color: .blue)
                    trendCard("Calories", unit: "kcal", avg: d.averages.kcal, values: d.points.map { ($0.date, $0.kcal) }, color: .orange)
                    trendCard("Protein", unit: "g", avg: d.averages.proteinG, values: d.points.map { ($0.date, $0.proteinG) }, color: .pink)
                    trendCard("Weight", unit: "kg", avg: d.averages.weightKg, values: d.points.map { ($0.date, $0.weightKg) }, color: .purple)
                }
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Trends")
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func trendCard(_ title: String, unit: String, avg: Double?, values: [(String, Double?)], color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                Text("avg \(avg.map { format($0) } ?? "—") \(unit)")
                    .font(.caption).foregroundStyle(.secondary).monospacedDigit()
            }
            Chart {
                ForEach(values.compactMap { pair -> (String, Double)? in
                    guard let v = pair.1 else { return nil }
                    return (pair.0, v)
                }, id: \.0) { pair in
                    LineMark(x: .value("Date", pair.0), y: .value(title, pair.1))
                        .foregroundStyle(color)
                        .interpolationMethod(.monotone)
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .frame(height: 140)
        }
        .card()
    }

    private func format(_ v: Double) -> String {
        v >= 100 ? String(Int(v.rounded())) : String(format: "%.1f", v)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            data = try await APIClient.shared.callAPI(
                path: "trends",
                body: ["range": range],
                as: TrendsResponse.self
            )
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
