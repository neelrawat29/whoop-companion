import SwiftUI

struct TabRoot: View {
    var body: some View {
        CoachBubbleHost {
            TabView {
                NavigationStack { HomeView() }
                    .tabItem { Label("Today", systemImage: "sun.max") }

                NavigationStack { LogView() }
                    .tabItem { Label("Log", systemImage: "square.and.pencil") }

                NavigationStack { InsightsView() }
                    .tabItem { Label("Insights", systemImage: "chart.line.uptrend.xyaxis") }

                NavigationStack { CommunityView() }
                    .tabItem { Label("Community", systemImage: "person.3") }

                NavigationStack { MoreView() }
                    .tabItem { Label("More", systemImage: "ellipsis.circle") }
            }
            .tint(Theme.accent)
        }
    }
}

// MARK: - Redesigned More screen

struct MoreView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                accountHeader

                menuGroup(title: "Track") {
                    NavigationLink { WeightView() } label: {
                        MenuTile(title: "Weight",
                                 subtitle: "Track weight and see your trend",
                                 systemImage: "scalemass",
                                 tint: Theme.accent)
                    }
                    Divider().padding(.leading, 54)
                    NavigationLink { MealsView() } label: {
                        MenuTile(title: "Meals",
                                 subtitle: "Log meals with AI macro estimates",
                                 systemImage: "fork.knife",
                                 tint: .orange)
                    }
                    Divider().padding(.leading, 54)
                    NavigationLink { SupplementsView() } label: {
                        MenuTile(title: "Supplements",
                                 subtitle: "Manage your supplement library",
                                 systemImage: "pills",
                                 tint: .green)
                    }
                }

                menuGroup(title: "Coach") {
                    NavigationLink { ChatThreadListView() } label: {
                        MenuTile(title: "Chat",
                                 subtitle: "Ask your AI recovery coach",
                                 systemImage: "bubble.left.and.bubble.right",
                                 tint: .purple)
                    }
                    Divider().padding(.leading, 54)
                    NavigationLink { BiologicalAgeView() } label: {
                        MenuTile(title: "Biological Age",
                                 subtitle: "Estimate your body's true age",
                                 systemImage: "sparkles",
                                 tint: .pink)
                    }
                }

                menuGroup(title: "Data") {
                    NavigationLink { ImportView() } label: {
                        MenuTile(title: "Import",
                                 subtitle: "CSV upload or screenshot AI",
                                 systemImage: "square.and.arrow.down",
                                 tint: .blue)
                    }
                }

                menuGroup(title: "App") {
                    NavigationLink { SettingsView() } label: {
                        MenuTile(title: "Settings",
                                 subtitle: "Profile, thresholds, sign out",
                                 systemImage: "gearshape",
                                 tint: .gray)
                    }
                }
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var accountHeader: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Theme.accent.opacity(0.15)).frame(width: 52, height: 52)
                Text(String(session.email.prefix(1)).uppercased())
                    .font(.title3.bold())
                    .foregroundStyle(Theme.accent)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(session.email.isEmpty ? "Signed in" : session.email)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text("Cove")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .card()
    }

    @ViewBuilder
    private func menuGroup<Content: View>(title: String,
                                          @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .padding(.horizontal, 12)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                        .strokeBorder(Theme.cardBorder, lineWidth: 1)
                )
        }
    }
}
