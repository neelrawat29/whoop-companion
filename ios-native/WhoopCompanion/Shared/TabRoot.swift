import SwiftUI

struct TabRoot: View {
    var body: some View {
        TabView {
            NavigationStack { LogView() }
                .tabItem { Label("Log", systemImage: "square.and.pencil") }

            NavigationStack { WeightView() }
                .tabItem { Label("Weight", systemImage: "scalemass") }

            NavigationStack { InsightsView() }
                .tabItem { Label("Insights", systemImage: "chart.line.uptrend.xyaxis") }

            NavigationStack { MealsView() }
                .tabItem { Label("Meals", systemImage: "fork.knife") }

            NavigationStack { MoreView() }
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        .tint(Theme.accent)
    }
}

struct MoreView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        List {
            NavigationLink("Supplements") { SupplementsView() }
            NavigationLink("Community") { CommunityView() }
            NavigationLink("Chat") { ChatView() }
            NavigationLink("Biological Age") { BiologicalAgeView() }
            Section {
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            }
        }
        .navigationTitle("More")
    }
}
