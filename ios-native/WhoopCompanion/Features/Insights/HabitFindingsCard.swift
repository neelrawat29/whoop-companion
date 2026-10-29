import SwiftUI

/// Response of /api/public/ios/habit-insights — the same analysis the web
/// Insights page runs (src/lib/habit-insights.ts).
struct HabitInsightsResponse: Decodable {
    let findings: [HabitFinding]
    let noClearLink: [String]
    let pairedNights: Int
    let windowDays: Int
}

struct HabitFinding: Decodable, Identifiable {
    let id: String
    let label: String
    let sentence: String
    let primary: OutcomeEffect
    let also: [OutcomeEffect]
}

struct OutcomeEffect: Decodable {
    let outcome: String
    let nWith: Int
    let nWithout: Int
    let confidence: String
    let notable: Bool
    let better: Bool
    let deltaText: String

    var outcomeLabel: String {
        switch outcome {
        case "recovery": "Recovery"
        case "hrv": "HRV"
        case "rhr": "Resting HR"
        case "sleep_hours": "Sleep"
        default: outcome
        }
    }

    var confidenceLabel: String {
        switch confidence {
        case "consistent": "Consistent"
        case "likely": "Likely"
        default: "Early sign"
        }
    }
}

struct HabitFindingsCard: View {
    let data: HabitInsightsResponse?
    let isLoading: Bool
    let failed: Bool
    /// Finding ids currently pinned to Today.
    var pinnedIds: Set<String> = []
    var pinBusy = false
    var onTogglePin: ((HabitFinding) -> Void)? = nil
    var retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Label("What affects your next morning", systemImage: "lightbulb")
                    .font(Theme.body(.headline))
                Text(subtitle)
                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if isLoading && data == nil {
                ProgressView().frame(maxWidth: .infinity, alignment: .leading)
            } else if failed && data == nil {
                HStack {
                    Text("Couldn't load patterns.").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Button("Try again", action: retry).buttonStyle(CoveButtonStyle())
                }
            } else if let data {
                if data.findings.isEmpty {
                    Text(data.noClearLink.isEmpty
                         ? "Log evening check-ins (drinks, caffeine, last meal, water) for a couple of weeks to see what affects your recovery."
                         : "No clear patterns yet. Keep logging your evening check-ins and they'll show up here.")
                        .font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(Array(data.findings.enumerated()), id: \.element.id) { i, f in
                    if i > 0 { Divider() }
                    row(f)
                }
                if !data.noClearLink.isEmpty {
                    (Text("No clear link yet: ").fontWeight(.semibold).foregroundStyle(Theme.textPrimary)
                     + Text(data.noClearLink.joined(separator: ", ") + "."))
                        .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private var subtitle: String {
        var s = "Each habit is compared with your recovery, HRV, resting heart rate and sleep the following morning"
        if let data { s += " over the last \(data.windowDays) days (\(data.pairedNights) matched nights)" }
        return s + ". These are patterns, not proof of cause."
    }

    private func row(_ f: HabitFinding) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline) {
                    Text(f.label).font(Theme.body(.subheadline).weight(.semibold))
                    Spacer(minLength: 8)
                    badges(f.primary)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(f.label).font(Theme.body(.subheadline).weight(.semibold))
                    badges(f.primary)
                }
            }
            Text(f.sentence)
                .font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .center, spacing: 8) {
                Text(detail(f))
                    .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary).monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let onTogglePin {
                    let pinned = pinnedIds.contains(f.id)
                    Button { onTogglePin(f) } label: {
                        Label(pinned ? "Pinned" : "Pin", systemImage: pinned ? "pin.fill" : "pin")
                            .font(Theme.body(.caption).weight(.semibold))
                            .foregroundStyle(pinned ? Theme.accent : Theme.textSecondary)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(pinBusy)
                    .accessibilityLabel(pinned ? "Unpin \(f.label) from Today" : "Pin \(f.label) to Today")
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func badges(_ e: OutcomeEffect) -> some View {
        HStack(spacing: 6) {
            if e.notable {
                Text("\(e.deltaText) \(e.outcomeLabel.lowercased())")
                    .font(Theme.body(.subheadline).weight(.semibold)).monospacedDigit()
                    .foregroundStyle(e.better ? Theme.recovery : Theme.danger)
            }
            Text(e.confidenceLabel.uppercased())
                .font(Theme.body(.caption2).weight(.medium))
                .padding(.horizontal, 7).padding(.vertical, 2)
                .foregroundStyle(e.confidence == "consistent" ? Theme.card : Theme.textPrimary)
                .background(Capsule().fill(e.confidence == "consistent" ? Theme.textPrimary : Color.clear))
                .overlay(Capsule().strokeBorder(Theme.cardBorder, style: StrokeStyle(lineWidth: 1, dash: e.confidence == "early" ? [3] : [])))
        }
    }

    private func detail(_ f: HabitFinding) -> String {
        var s = "\(f.primary.nWith) nights with · \(f.primary.nWithout) without"
        if !f.also.isEmpty {
            s += " · Also: " + f.also.map { "\($0.outcomeLabel) \($0.deltaText)" }.joined(separator: ", ")
        }
        return s
    }
}
