import Foundation
import Supabase

/// Shared Supabase client. Session is persisted to Keychain by supabase-swift.
final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        self.client = SupabaseClient(
            supabaseURL: Config.supabaseURL,
            supabaseKey: Config.supabasePublishableKey
        )
    }

    /// Access token for the current session, or nil if signed out.
    func accessToken() async -> String? {
        try? await client.auth.session.accessToken
    }
}
