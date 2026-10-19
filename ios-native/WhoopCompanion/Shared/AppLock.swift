import SwiftUI
import LocalAuthentication

/// Face ID / Touch ID app lock. Preference is stored on-device only.
enum AppLock {
    static let enabledKey = "appLockEnabled"

    enum Kind { case faceID, touchID, opticID, none }

    static var kind: Kind {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else { return .none }
        switch ctx.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default: return .none
        }
    }

    static var name: String {
        switch kind {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "Passcode"
        }
    }

    static var icon: String {
        switch kind {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        case .none: return "lock.fill"
        }
    }

    /// Biometrics with automatic device-passcode fallback, so nobody gets locked out.
    static func authenticate(reason: String = "Unlock Cove") async -> Bool {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "Use Passcode"
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { return true }
        return (try? await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) ?? false
    }
}

/// Covers the app until the user authenticates.
struct LockScreen: View {
    let onUnlock: () -> Void
    @State private var busy = false

    var body: some View {
        ZStack {
            Rectangle().fill(Theme.background).ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: AppLock.icon)
                    .font(.system(size: 56, weight: .light))
                    .foregroundStyle(Theme.accent)
                Text("Cove is locked").font(Theme.heading(.title2))
                Text("Your health data stays private.").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                Button {
                    Task { await unlock() }
                } label: {
                    Label("Unlock with \(AppLock.name)", systemImage: AppLock.icon)
                        .frame(maxWidth: 260)
                }
                .buttonStyle(CoveButtonStyle(prominent: true))
                .controlSize(.large)
                .disabled(busy)
            }
            .padding()
        }
        .task { await unlock() }
    }

    private func unlock() async {
        guard !busy else { return }
        busy = true
        if await AppLock.authenticate() {
            Haptics.success()
            onUnlock()
        }
        busy = false
    }
}

struct SecuritySection: View {
    @AppStorage(AppLock.enabledKey) private var enabled = false

    var body: some View {
        Section {
            Toggle(isOn: Binding(
                get: { enabled },
                set: { newValue in
                    // Confirm identity before changing the lock either way.
                    Task {
                        if await AppLock.authenticate(reason: newValue ? "Turn on \(AppLock.name) lock" : "Turn off \(AppLock.name) lock") {
                            enabled = newValue
                            Haptics.tap()
                        }
                    }
                }
            )) {
                Label("Require \(AppLock.name)", systemImage: AppLock.icon)
            }
        } header: {
            Text("Security")
        } footer: {
            Text("Cove locks when you leave the app and asks for \(AppLock.name) when you return. Your device passcode always works as a backup.")
        }
    }
}
