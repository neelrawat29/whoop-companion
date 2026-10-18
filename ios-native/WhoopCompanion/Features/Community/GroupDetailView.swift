import SwiftUI

struct GroupDetailView: View {
    let group: Group
    @State private var rows: [LeaderboardRow] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                LabeledContent("Invite code", value: group.inviteCode)
            }
            Section("Leaderboard (7d)") {
                if isLoading && rows.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                if !isLoading && rows.isEmpty && errorMessage == nil {
                    Text("No activity yet. Share the invite code — members appear here once they log a day.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                ForEach(rows) { r in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(r.displayName).font(.headline).lineLimit(1)
                            if r.isOwner { Text("owner").font(.caption).foregroundStyle(.secondary) }
                            Spacer()
                            if r.loggedToday {
                                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                                    .accessibilityLabel("Logged today")
                            }
                        }
                        Text("Streak \(r.currentStreak) • Logged \(r.daysLogged7d)/7")
                            .font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 12) {
                            if let v = r.avgRecovery7d { Label("\(Int(v.rounded()))%", systemImage: "heart.fill") }
                            if let v = r.avgSleepHours7d { Label(String(format: "%.1f h", v), systemImage: "moon.fill") }
                        }
                        .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                    Button("Try again") { Task { await load() } }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(group.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink { GroupSettingsView(group: group) } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .task { await load() }
    }

    func load() async {
        isLoading = true; errorMessage = nil; defer { isLoading = false }
        struct Params: Encodable { let _group_id: UUID }
        do {
            rows = try await SupabaseManager.shared.client
                .rpc("group_leaderboard", params: Params(_group_id: group.id))
                .execute().value
        } catch { errorMessage = error.localizedDescription }
    }
}
