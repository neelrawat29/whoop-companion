import SwiftUI
import Supabase
import AuthenticationServices


struct AuthView: View {
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @Environment(\.openURL) private var openURL
    @State private var currentNonce: String?

    

    enum Mode { case signIn, signUp }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer(minLength: 40)
                VStack(spacing: 8) {
                    Image("CoveLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 96, height: 96)
                        .accessibilityHidden(true)
                    Text("Cove")
                        .font(Theme.heading(.largeTitle))
                    Text(mode == .signIn ? "Sign in to your account" : "Create an account")
                        .foregroundStyle(Theme.textSecondary)
                }

                VStack(spacing: 12) {
                    SignInWithAppleButton(.continue) { request in
                        let nonce = AppleSignInHelper.randomNonceString()
                        currentNonce = nonce
                        request.requestedScopes = [.fullName, .email]
                        request.nonce = AppleSignInHelper.sha256(nonce)
                    } onCompletion: { result in
                        handleAppleCompletion(result)
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 48)
                    .cornerRadius(10)

                    GoogleSignInButton { signInWithGoogle() }
                        .disabled(isLoading)

                    HStack {
                        Rectangle().frame(height: 1).foregroundStyle(Theme.textSecondary.opacity(0.3))
                        Text("or").font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
                        Rectangle().frame(height: 1).foregroundStyle(Theme.textSecondary.opacity(0.3))
                    }
                    .padding(.vertical, 4)

                    LabeledTextField(
                        "Email",
                        placeholder: "you@example.com",
                        text: $email,
                        keyboard: .emailAddress,
                        autocapitalization: .never,
                        autocorrect: false
                    )

                    LabeledTextField(
                        "Password",
                        placeholder: mode == .signIn ? "Your password" : "At least 6 characters",
                        hint: mode == .signUp ? "Use at least 6 characters." : nil,
                        text: $password,
                        isSecure: true,
                        autocapitalization: .never
                    )

                    if mode == .signIn {
                        // Reset happens on the web: the app's sign-in uses a PKCE
                        // handshake that an emailed link opened elsewhere can't finish.
                        Button("Forgot password?") {
                            openURL(Config.apiBaseURL.appending(path: "auth").appending(queryItems: [URLQueryItem(name: "mode", value: "forgot")]))
                        }
                        .font(Theme.body(.footnote))
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .trailing)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(Theme.body(.footnote))
                            .foregroundStyle(Theme.danger)
                    }

                    Button(action: submit) {
                        HStack {
                            if isLoading { ProgressView().controlSize(.regular) }
                            Text(mode == .signIn ? "Sign in" : "Create account")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(CoveButtonStyle(prominent: true))
                    .controlSize(.large)
                    .disabled(isLoading || email.isEmpty || password.count < 6)

                    Button(mode == .signIn ? "Need an account? Sign up" : "Have an account? Sign in") {
                        mode = mode == .signIn ? .signUp : .signIn
                        errorMessage = nil
                    }
                    .font(Theme.body(.footnote))
                }
                .padding(.horizontal)

                Spacer()
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
    }

    private func submit() {
        isLoading = true
        errorMessage = nil
        Task {
            defer { isLoading = false }
            do {
                if mode == .signIn {
                    try await SupabaseManager.shared.client.auth.signIn(email: email, password: password)
                } else {
                    try await SupabaseManager.shared.client.auth.signUp(email: email, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8),
                let nonce = currentNonce
            else {
                errorMessage = "Apple sign-in failed: missing identity token."
                return
            }
            isLoading = true
            errorMessage = nil
            Task {
                defer { isLoading = false }
                do {
                    try await SupabaseManager.shared.client.auth.signInWithIdToken(
                        credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
                    )
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func signInWithGoogle() {
        isLoading = true
        errorMessage = nil
        Task {
            defer { isLoading = false }
            do {
                try await SupabaseManager.shared.client.auth.signInWithOAuth(
                    provider: .google,
                    redirectTo: Config.oauthRedirectURL,
                    launchFlow: { url in
                        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                            let session = ASWebAuthenticationSession(
                                url: url,
                                callbackURLScheme: Config.oauthRedirectURL.scheme ?? "cove"
                            ) { callbackURL, error in
                                if let error {
                                    continuation.resume(throwing: error)
                                } else if let callbackURL {
                                    continuation.resume(returning: callbackURL)
                                } else {
                                    continuation.resume(throwing: URLError(.badServerResponse))
                                }
                            }
                            session.presentationContextProvider = WebAuthPresentationProvider.shared
                            session.prefersEphemeralWebBrowserSession = false
                            if !session.start() {
                                continuation.resume(throwing: URLError(.cannotOpenFile))
                            }
                        }
                    }
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

final class WebAuthPresentationProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthPresentationProvider()
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = scene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }
}

