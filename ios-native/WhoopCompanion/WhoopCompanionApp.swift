import SwiftUI
import Supabase

@main
struct WhoopCompanionApp: App {
    @State private var session = SessionStore()





    init() { Theme.configureAppearance() }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .font(Theme.body())
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
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
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(AppLock.enabledKey) private var lockEnabled = false
    /// Locked on cold start when enabled; re-locks when the app goes to background.
    @State private var locked = UserDefaults.standard.bool(forKey: AppLock.enabledKey)
    /// nil = still checking; new accounts must finish setup before the tabs.
    @State private var onboardingDone: Bool?
    @State private var launchFinished = false

    private var launchDestinationReady: Bool {
        switch session.state {
        case .loading: return false
        case .signedOut: return true
        case .signedIn: return onboardingDone != nil
        }
    }

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

            if lockEnabled && locked && session.userId != nil {
                LockScreen { withAnimation { locked = false } }
                    .transition(.opacity)
                    .zIndex(10)
            }

            if !launchFinished {
                LaunchTransition(destinationReady: launchDestinationReady) {
                    launchFinished = true
                }
                .zIndex(20)
            }
        }
        .onChange(of: session.state) { _, _ in onboardingDone = nil }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background && lockEnabled { locked = true }
        }
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
