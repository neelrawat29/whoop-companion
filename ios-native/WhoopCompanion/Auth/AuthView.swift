import SwiftUI
import Supabase

struct AuthView: View {
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

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
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)

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
}
