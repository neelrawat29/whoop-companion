import SwiftUI

@main
struct WhoopCompanionApp: App {
    @State private var session = SessionStore()





    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .task {
                    await session.bootstrap()
                    await RecapNotifier.requestAndScheduleDaily()
                }
                .preferredColorScheme(.light)
                .onOpenURL { url in
                    Task {
                        try? await SupabaseManager.shared.client.auth.session(from: url)
                    }
                }
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session
    /// nil = still checking; new accounts must finish setup before the tabs.
    @State private var onboardingDone: Bool?

    var body: some View {
        ZStack {
            switch session.state {
            case .loading:
                ProgressView().controlSize(.large)
            case .signedOut:
                AuthView()
            case .signedIn(let userId):
                switch onboardingDone {
                case .none:
                    ProgressView().controlSize(.large)
                        .task(id: userId) { await checkOnboarding(userId) }
                case .some(false):
                    OnboardingView(userId: userId) { withAnimation { onboardingDone = true } }
                case .some(true):
                    TabRoot()
                }
            }
        }
        .onChange(of: session.state) { _, _ in onboardingDone = nil }
        .animation(.easeInOut(duration: 0.2), value: session.state)
    }

    private func checkOnboarding(_ userId: UUID) async {
        struct P: Decodable { let onboarding_completed: Bool }
        let p: P? = try? await SupabaseManager.shared.client.from("profiles")
            .select("onboarding_completed").eq("id", value: userId).single().execute().value
        // If the check fails (offline), don't lock the user out of their data.
        onboardingDone = p?.onboarding_completed ?? true
    }
}
