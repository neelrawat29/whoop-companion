import SwiftUI
import Supabase
import AuthenticationServices

struct AuthView: View {
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var currentNonce: String?

    @Environment(\.webAuthenticationSession) private var webAuthSession

    enum Mode { case signIn, signUp }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer(minLength: 40)
                VStack(spacing: 8) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 48))
                        .foregroundStyle(Theme.accent)
                    Text("Whoop Companion")
                        .font(.largeTitle.bold())
                    Text(mode == .signIn ? "Sign in to your account" : "Create an account")
                        .foregroundStyle(.secondary)
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
                        Rectangle().frame(height: 1).foregroundStyle(.secondary.opacity(0.3))
                        Text("or").font(.footnote).foregroundStyle(.secondary)
                        Rectangle().frame(height: 1).foregroundStyle(.secondary.opacity(0.3))
                    }
                    .padding(.vertical, 4)

                    LabeledTextField(
                        "Email",
                        placeholder: "you@example.com",
                        required: true,
                        text: $email,
                        keyboard: .emailAddress,
                        autocapitalization: .never,
                        autocorrect: false
                    )

                    LabeledTextField(
                        "Password",
                        placeholder: mode == .signIn ? "Your password" : "At least 6 characters",
                        required: true,
                        hint: mode == .signUp ? "Use at least 6 characters." : nil,
                        text: $password,
                        isSecure: true,
                        autocapitalization: .never
                    )

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button(action: submit) {
                        HStack {
                            if isLoading { ProgressView().controlSize(.small) }
                            Text(mode == .signIn ? "Sign in" : "Create account")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(isLoading || email.isEmpty || password.count < 6)

                    Button(mode == .signIn ? "Need an account? Sign up" : "Have an account? Sign in") {
                        mode = mode == .signIn ? .signUp : .signIn
                        errorMessage = nil
                    }
                    .font(.footnote)
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
                    redirectTo: URL(string: "whoopcompanion://login-callback"),
                    launchFlow: { url in
                        try await webAuthSession.authenticate(
                            using: url,
                            callbackURLScheme: "whoopcompanion"
                        )
                    }
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
