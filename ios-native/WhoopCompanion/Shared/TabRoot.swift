import SwiftUI

private enum CoveTab: Int, CaseIterable, Identifiable {
    case today, log, insights, community, more
    var id: Int { rawValue }
    var title: String {
        switch self { case .today: "Today"; case .log: "Log"; case .insights: "Insights"; case .community: "Community"; case .more: "More" }
    }
    var icon: String {
        switch self { case .today: "sun.max"; case .log: "square.and.pencil"; case .insights: "chart.bar"; case .community: "person.3"; case .more: "ellipsis" }
    }
}

struct TabRoot: View {
    @State private var selection: CoveTab = .today

    var body: some View {
        CoachBubbleHost {
            TabView(selection: $selection) {
                NavigationStack { HomeView() }.tag(CoveTab.today)
                NavigationStack { LogView() }.tag(CoveTab.log)
                NavigationStack { InsightsView() }.tag(CoveTab.insights)
                NavigationStack { CommunityView() }.tag(CoveTab.community)
                NavigationStack { MoreView() }.tag(CoveTab.more)
            }
            .toolbar(.hidden, for: .tabBar)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { dock }
        .background(Theme.background.ignoresSafeArea())
        .tint(Theme.accent)
    }

    private var dock: some View {
        HStack(spacing: 0) {
            ForEach(CoveTab.allCases) { tab in
                Button {
                    guard selection != tab else { return }
                    Haptics.selection()
                    selection = tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 20, weight: selection == tab ? .semibold : .regular))
                            .frame(height: 24)
                        Text(tab.title)
                            .font(Theme.body(.caption2))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Circle().fill(selection == tab ? Theme.accent : .clear)
                            .frame(width: 4, height: 4)
                    }
                    .foregroundStyle(selection == tab ? Theme.danger : Theme.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 58)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(selection == tab ? [.isSelected] : [])
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Theme.shadow.opacity(0.10), radius: 16, x: 0, y: 5)
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 8)
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
                                 subtitle: "Bring in past WHOOP history (CSV)",
                                 systemImage: "square.and.arrow.down",
                                 tint: .blue)
                    }
                }

                menuGroup(title: "App") {
                    NavigationLink { SettingsView() } label: {
                        MenuTile(title: "Settings",
                                 subtitle: "Profile, targets, WHOOP, sign out",
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
