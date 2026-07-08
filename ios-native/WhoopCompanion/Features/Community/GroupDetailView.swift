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
                if isLoading { ProgressView() }
                ForEach(rows) { r in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(r.displayName).font(.headline)
                            if r.isOwner { Text("owner").font(.caption).foregroundStyle(.secondary) }
                            Spacer()
                            if r.loggedToday { Image(systemName: "checkmark.seal.fill").foregroundStyle(.green) }
                        }
                        Text("Streak \(r.currentStreak) • Logged \(r.daysLogged7d)/7")
                            .font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 12) {
                            if let v = r.avgRecovery7d { Text("Rec \(v, format: .number.precision(.fractionLength(1)))") }
                            if let v = r.avgSleepHours7d { Text("Sleep \(v, format: .number.precision(.fractionLength(1)))h") }
                            if let v = r.avgEnergy7d { Text("Energy \(v, format: .number.precision(.fractionLength(1)))") }
                        }
                        .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
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
        isLoading = true; defer { isLoading = false }
        struct Params: Encodable { let _group_id: UUID }
        do {
            rows = try await SupabaseManager.shared.client
                .rpc("group_leaderboard", params: Params(_group_id: group.id))
                .execute().value
        } catch { errorMessage = error.localizedDescription }
    }
}
