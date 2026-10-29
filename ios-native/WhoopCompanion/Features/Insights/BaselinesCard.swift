import SwiftUI
import Charts

/// Response of /api/public/ios/baselines — same calculation as the web
/// Insights page (src/lib/baselines.ts).
struct BaselinesResponse: Decodable {
    let metrics: [MetricBaseline]
    let windowDays: Int
}

struct MetricBaseline: Decodable, Identifiable {
    struct Latest: Decodable { let date: String; let value: Double; let text: String }
    struct Range: Decodable { let low: Double; let high: Double; let text: String }
    struct Point: Decodable, Identifiable {
        let date: String
        let value: Double
        let low: Double?
        let high: Double?
        var id: String { date }
        var day: Date { DateFormatter.entryDate.date(from: date) ?? .distantPast }
    }

    let metric: String
    let label: String
    let unit: String
    let latest: Latest?
    let range: Range?
    let status: String?
    let concerning: Bool
    let summary: String
    let series: [Point]
    var id: String { metric }

    var statusText: String? {
        switch status {
        case "below": "Below usual"
        case "above": "Above usual"
        case "within": "Usual"
        default: nil
        }
    }
}

struct BaselinesCard: View {
    let data: BaselinesResponse?
    let isLoading: Bool
    let failed: Bool
    var retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Label("Compared with your normal", systemImage: "waveform.path.ecg")
                    .font(Theme.body(.headline))
                Text("Shaded band = your usual range, based on the \(data?.windowDays ?? 30) days before each day.")
                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if isLoading && data == nil {
                ProgressView().frame(maxWidth: .infinity, alignment: .leading)
            } else if failed && data == nil {
                HStack {
                    Text("Couldn't load your ranges.").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Button("Try again", action: retry).buttonStyle(CoveButtonStyle())
                }
            } else if let data {
                ForEach(Array(data.metrics.enumerated()), id: \.element.id) { i, m in
                    if i > 0 { Divider() }
                    row(m)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func row(_ m: MetricBaseline) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.label).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(m.latest?.text ?? "—").font(Theme.heading(.title3)).monospacedDigit()
                        if let d = m.latest.flatMap({ DateFormatter.entryDate.date(from: $0.date) }) {
                            Text(d.formatted(.dateTime.day().month(.abbreviated)))
                                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                Spacer(minLength: 8)
                if let s = m.statusText {
                    Text(s)
                        .font(Theme.body(.caption).weight(.medium))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .foregroundStyle(m.concerning ? Theme.danger : Theme.textSecondary)
                        .overlay(Capsule().strokeBorder(m.concerning ? Theme.danger.opacity(0.4) : Theme.cardBorder))
                }
            }
            Text(m.summary + (m.range.map { " Usual: \($0.text)." } ?? ""))
                .font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if m.series.count > 1 {
                Chart {
                    ForEach(m.series) { p in
                        if let lo = p.low, let hi = p.high {
                            AreaMark(x: .value("Date", p.day, unit: .day), yStart: .value("Low", lo), yEnd: .value("High", hi))
                                .foregroundStyle(Theme.textSecondary.opacity(0.15))
                                .interpolationMethod(.monotone)
                        }
                    }
                    ForEach(m.series) { p in
                        LineMark(x: .value("Date", p.day, unit: .day), y: .value(m.label, p.value))
                            .foregroundStyle(Theme.textPrimary)
                            .interpolationMethod(.monotone)
                        PointMark(x: .value("Date", p.day, unit: .day), y: .value(m.label, p.value))
                            .foregroundStyle(Theme.textPrimary).symbolSize(12)
                    }
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 110)
                .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .contain)
    }
}
