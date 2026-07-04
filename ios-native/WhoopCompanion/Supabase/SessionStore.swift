import Foundation
import Supabase
import Observation

@Observable
final class SessionStore {
    enum State: Equatable { case loading, signedOut, signedIn(userId: UUID) }

    var state: State = .loading
    private var listenerTask: Task<Void, Never>?

    func bootstrap() async {
        // Prime with existing session if any
        if let session = try? await SupabaseManager.shared.client.auth.session {
            state = .signedIn(userId: session.user.id)
        } else {
            state = .signedOut
        }

        // Listen for changes
        listenerTask?.cancel()
        listenerTask = Task { [weak self] in
            for await change in await SupabaseManager.shared.client.auth.authStateChanges {
                guard let self else { return }
                await MainActor.run {
                    if let session = change.session {
                        self.state = .signedIn(userId: session.user.id)
                    } else {
                        self.state = .signedOut
                    }
                }
            }
        }
    }

    func signOut() async {
        try? await SupabaseManager.shared.client.auth.signOut()
        state = .signedOut
    }

    var userId: UUID? {
        if case .signedIn(let id) = state { return id }
        return nil
    }
}
