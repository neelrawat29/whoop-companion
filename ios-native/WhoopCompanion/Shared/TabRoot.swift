import SwiftUI

struct TabRoot: View {
    var body: some View {
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

struct MoreView: View {
    var body: some View {
        List {
            Section("Track") {
                NavigationLink("Weight") { WeightView() }
                NavigationLink("Meals") { MealsView() }
                NavigationLink("Supplements") { SupplementsView() }
            }
            Section("Coach") {
                NavigationLink("Chat") { ChatThreadListView() }
                NavigationLink("Biological Age") { BiologicalAgeView() }
            }
            Section("Data") {
                NavigationLink("Import") { ImportView() }
            }
            Section("App") {
                NavigationLink("Settings") { SettingsView() }
            }
        }
        .navigationTitle("More")
    }
}
