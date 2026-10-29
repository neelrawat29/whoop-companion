import SwiftUI

/// Response of /api/public/ios/weekly-summary — same summary as the web
/// Insights page (src/lib/weekly-summary.ts).
struct WeeklySummaryResponse: Decodable {
    struct Metric: Decodable, Identifiable {
        let key: String
        let label: String
        let thisWeek: Double?
        let thisText: String
        let deltaText: String?
        let better: Bool?
        var id: String { key }
    }
    struct DayNote: Decodable {
        let dayLabel: String
        let recovery: Int
        let notes: [String]
    }
    struct Logging: Decodable { let eveningCheckIns: Int; let mealDays: Int; let days: Int }

    let start: String
    let end: String
    let headline: String
    let metrics: [Metric]
    let best: DayNote?
    let worst: DayNote?
    let logging: Logging
}

struct WeeklySummaryCard: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let data: WeeklySummaryResponse?
    let isLoading: Bool
    let failed: Bool
    var retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Your week", systemImage: "calendar").font(Theme.body(.headline))
                Text(subtitle).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            }
            if isLoading && data == nil {
                ProgressView().frame(maxWidth: .infinity, alignment: .leading)
            } else if failed && data == nil {
                HStack {
                    Text("Couldn't load your week.").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Button("Try again", action: retry).buttonStyle(CoveButtonStyle())
                }
            } else if let data {
                Text(data.headline)
                    .font(Theme.body(.body).weight(.medium))
                    .fixedSize(horizontal: false, vertical: true)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .topLeading),
                                         count: dynamicTypeSize.isAccessibilitySize ? 1 : 2),
                          alignment: .leading, spacing: 12) {
                    ForEach(data.metrics.filter { $0.thisWeek != nil }) { m in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.label).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                            Text(m.thisText).font(Theme.heading(.headline)).monospacedDigit()
                            if let d = m.deltaText {
                                Text("\(d) vs last week")
                                    .font(Theme.body(.caption)).monospacedDigit()
                                    .foregroundStyle(m.better == true ? Theme.recovery : m.better == false ? Theme.danger : Theme.textSecondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityElement(children: .combine)
                    }
                }

                if let best = data.best { dayBox("Best day", best) }
                if let worst = data.worst { dayBox("Toughest day", worst) }

                Text("Logged this week: \(data.logging.eveningCheckIns)/\(data.logging.days) evening check-ins · \(data.logging.mealDays)/\(data.logging.days) days of meals")
                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private var subtitle: String {
        guard let data,
              let s = DateFormatter.entryDate.date(from: data.start),
              let e = DateFormatter.entryDate.date(from: data.end) else { return "Last 7 days compared with the 7 before" }
        let f: (Date) -> String = { $0.formatted(.dateTime.day().month(.abbreviated)) }
        return "\(f(s)) – \(f(e)) · compared with the 7 days before"
    }

    private func dayBox(_ title: String, _ d: WeeklySummaryResponse.DayNote) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            Text("\(d.dayLabel) · \(d.recovery)% recovery").font(Theme.body(.subheadline).weight(.semibold))
            if !d.notes.isEmpty {
                Text(d.notes.joined(separator: " · "))
                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.cardBorder))
        .accessibilityElement(children: .combine)
    }
}
