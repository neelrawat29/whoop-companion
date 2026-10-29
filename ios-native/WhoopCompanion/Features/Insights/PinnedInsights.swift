import SwiftUI
import Supabase

/// A finding pinned from Insights to Today. Same rows and `source` format as the
/// web (src/lib/pinned-insights.ts): habit findings use "habit:<finding id>".
struct PinnedInsight: Decodable, Identifiable {
    let id: UUID
    let content: String
    let source: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, content, source
        case createdAt = "created_at"
    }
}

extension Notification.Name {
    /// Posted after pins change so Today refreshes without a pull-to-refresh.
    static let pinnedInsightsChanged = Notification.Name("pinnedInsightsChanged")
}

enum PinnedInsightsStore {
    private static var client: SupabaseClient { SupabaseManager.shared.client }

    static func source(for findingId: String) -> String { "habit:\(findingId)" }

    static func load() async throws -> [PinnedInsight] {
        try await client.from("pinned_insights").select("id,content,source,created_at")
            .order("created_at", ascending: false).execute().value
    }

    /// Pins a habit finding unless it's already pinned.
    static func pin(_ f: HabitFinding) async throws {
        let userId = try await client.auth.session.user.id
        let src = source(for: f.id)
        struct IdRow: Decodable { let id: UUID }
        let existing: [IdRow] = try await client.from("pinned_insights").select("id")
            .eq("source", value: src).limit(1).execute().value
        if existing.isEmpty {
            struct Insert: Encodable { let user_id: UUID; let source: String; let content: String }
            try await client.from("pinned_insights")
                .insert(Insert(user_id: userId, source: src, content: f.sentence)).execute()
        }
        notifyChanged()
    }

    static func unpin(id: UUID) async throws {
        try await client.from("pinned_insights").delete().eq("id", value: id).execute()
        notifyChanged()
    }

    /// Updates saved text for pins whose finding now reads differently.
    static func refresh(_ pins: [PinnedInsight], with findings: [HabitFinding]) async {
        let latest = Dictionary(findings.map { (source(for: $0.id), $0.sentence) }, uniquingKeysWith: { a, _ in a })
        var changed = false
        for p in pins {
            guard let src = p.source, let text = latest[src], text != p.content else { continue }
            struct Up: Encodable { let content: String }
            if (try? await client.from("pinned_insights").update(Up(content: text)).eq("id", value: p.id).execute()) != nil {
                changed = true
            }
        }
        if changed { notifyChanged() }
    }

    private static func notifyChanged() {
        Task { @MainActor in NotificationCenter.default.post(name: .pinnedInsightsChanged, object: nil) }
    }
}

/// Today card listing pinned findings. Hidden by the caller when empty.
struct PinnedInsightsCard: View {
    let pins: [PinnedInsight]
    var onUnpin: (PinnedInsight) -> Void
    var onOpenInsights: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Pinned", systemImage: "pin").font(Theme.body(.headline))
                Spacer()
                Button("All insights", action: onOpenInsights).font(Theme.body(.caption))
            }
            ForEach(Array(pins.enumerated()), id: \.element.id) { i, p in
                if i > 0 { Divider() }
                HStack(alignment: .top, spacing: 8) {
                    Text(p.content)
                        .font(Theme.body(.subheadline))
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button { onUnpin(p) } label: {
                        Image(systemName: "xmark").font(Theme.body(.caption).weight(.semibold))
                            .foregroundStyle(Theme.textSecondary)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, -12)
                    .accessibilityLabel("Unpin")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}
