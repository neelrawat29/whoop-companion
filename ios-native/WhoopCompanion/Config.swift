import Foundation

enum Config {
    static let supabaseURL = URL(string: "https://eltqjmvwgweotdulrnud.supabase.co")!
    static let supabasePublishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdHFqbXZ3Z3dlb3RkdWxybnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjY4NTYsImV4cCI6MjA5Njg0Mjg1Nn0.r8fC2G08Yv7gM4EVyhgMg20Bist_CrvZCG2FoDzb7j0"

    /// Base URL of the deployed web app — TanStack server functions and /api/chat live here.
    static let apiBaseURL = URL(string: "https://cove-companion.lovable.app")!

    /// Deep link callback for OAuth (matches CFBundleURLSchemes in Info.plist).
    static let oauthRedirectURL = URL(string: "cove://auth-callback")!
}
