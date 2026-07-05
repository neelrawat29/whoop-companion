import Foundation
import Supabase
import Observation

@Observable
final class SessionStore {
    enum State: Equatable { case loading, signedOut, signedIn(userId: UUID) }

    var state: State = .loading
    var email: String = ""
    private var listenerTask: Task<Void, Never>?

    func bootstrap() async {
        if let session = try? await SupabaseManager.shared.client.auth.session {
            state = .signedIn(userId: session.user.id)
            email = session.user.email ?? ""
        } else {
            state = .signedOut
            email = ""
        }

        listenerTask?.cancel()
        listenerTask = Task { [weak self] in
            for await change in SupabaseManager.shared.client.auth.authStateChanges {
                guard let self else { return }
                await MainActor.run {
                    if let session = change.session {
                        self.state = .signedIn(userId: session.user.id)
                        self.email = session.user.email ?? ""
                    } else {
                        self.state = .signedOut
                        self.email = ""
                    }
                }
            }
        }
    }

    func signOut() async {
        try? await SupabaseManager.shared.client.auth.signOut()
        state = .signedOut
        email = ""
    }

    var userId: UUID? {
        if case .signedIn(let id) = state { return id }
        return nil
    }
}
