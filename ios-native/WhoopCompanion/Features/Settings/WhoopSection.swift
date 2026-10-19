import SwiftUI
import AuthenticationServices

/// Connect / sync / disconnect WHOOP. Tokens stay on Cove's server; the app only sees status.
@Observable
final class WhoopViewModel: NSObject, ASWebAuthenticationPresentationContextProviding {
    var connected = false
    var lastSyncedAt: Date?
    var isBusy = false
    var message: String?
    var isError = false

    private struct ActionBody: Encodable { let action: String }
    private struct Status: Decodable { let connected: Bool; let lastSyncedAt: String? }
    private struct ConnectResp: Decodable { let url: String }
    private struct SyncResp: Decodable { let days: Int }
    private struct OKResp: Decodable { let ok: Bool }

    private var authSession: ASWebAuthenticationSession?

    func loadStatus() async {
        do {
            let s = try await APIClient.shared.callAPI(path: "whoop", body: ActionBody(action: "status"), as: Status.self)
            connected = s.connected
            lastSyncedAt = s.lastSyncedAt.flatMap { Self.parseDate($0) }
        } catch { /* leave as-is */ }
    }

    @MainActor
    func connect() async {
        isBusy = true; message = nil
        defer { isBusy = false }
        do {
            let r = try await APIClient.shared.callAPI(path: "whoop", body: ActionBody(action: "connect"), as: ConnectResp.self)
            guard let url = URL(string: r.url) else { return }
            let callback: URL = try await withCheckedThrowingContinuation { cont in
                let s = ASWebAuthenticationSession(url: url, callbackURLScheme: "cove") { url, error in
                    if let url { cont.resume(returning: url) }
                    else { cont.resume(throwing: error ?? URLError(.cancelled)) }
                }
                s.presentationContextProvider = self
                s.prefersEphemeralWebBrowserSession = false
                authSession = s
                s.start()
            }
            let status = URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "status" })?.value
            switch status {
            case "connected": show("WHOOP connected — recent days imported.", error: false); Haptics.success()
            case "denied": show("Connection cancelled.", error: false)
            default: show("Couldn't connect WHOOP. Please try again.", error: true)
            }
            await loadStatus()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            // user closed the sheet
        } catch {
            show("Couldn't start the WHOOP connection.", error: true)
        }
    }

    func sync() async {
        isBusy = true; defer { isBusy = false }
        do {
            let r = try await APIClient.shared.callAPI(path: "whoop", body: ActionBody(action: "sync"), as: SyncResp.self)
            show("Synced \(r.days) day\(r.days == 1 ? "" : "s") from WHOOP.", error: false)
            await loadStatus()
        } catch { show("Sync failed. Try reconnecting.", error: true) }
    }

    func disconnect() async {
        isBusy = true; defer { isBusy = false }
        do {
            _ = try await APIClient.shared.callAPI(path: "whoop", body: ActionBody(action: "disconnect"), as: OKResp.self)
            connected = false; lastSyncedAt = nil
            show("WHOOP disconnected.", error: false)
        } catch { show("Couldn't disconnect.", error: true) }
    }

    private func show(_ text: String, error: Bool) { message = text; isError = error }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }

    private static func parseDate(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}

struct WhoopSection: View {
    @State private var vm = WhoopViewModel()

    var body: some View {
        Section {
            HStack {
                Text("Status")
                Spacer()
                Text(vm.connected ? "Connected" : "Not connected")
                    .foregroundStyle(vm.connected ? Theme.recovery : Theme.textSecondary)
            }
            if vm.connected {
                if let d = vm.lastSyncedAt {
                    HStack {
                        Text("Last synced").foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text(d, format: .relative(presentation: .named)).foregroundStyle(Theme.textSecondary)
                    }.font(Theme.body(.footnote))
                }
                Button {
                    Task { await vm.sync() }
                } label: {
                    if vm.isBusy { ProgressView() } else { Text("Sync now") }
                }
                .disabled(vm.isBusy)
                Button("Disconnect", role: .destructive) {
                    Task { await vm.disconnect() }
                }
                .disabled(vm.isBusy)
            } else {
                Button {
                    Task { await vm.connect() }
                } label: {
                    if vm.isBusy { ProgressView() } else { Text("Connect WHOOP") }
                }
                .disabled(vm.isBusy)
            }
            if let m = vm.message {
                Text(m).font(Theme.body(.footnote)).foregroundStyle(vm.isError ? Theme.danger : Theme.recovery)
            }
        } header: {
            Text("WHOOP")
        } footer: {
            Text("Recovery, HRV, resting heart rate, sleep and strain fill in automatically every hour.")
        }
        .task { await vm.loadStatus() }
    }
}
