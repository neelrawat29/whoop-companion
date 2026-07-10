import SwiftUI

@main
struct WhoopCompanionApp: App {
    @State private var session = SessionStore()

    init() {
        KeyboardAccessorySetup.install()
    }


    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .task { await session.bootstrap() }
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

    var body: some View {
        ZStack {
            switch session.state {
            case .loading:
                ProgressView().controlSize(.large)
            case .signedOut:
                AuthView()
            case .signedIn:
                TabRoot()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: session.state)
    }
}
