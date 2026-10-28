import SwiftUI

/// Continues the system's static launch screen, once per app-window lifetime.
struct LaunchTransition: View {
    let destinationReady: Bool
    let onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var minimumElapsed = false
    @State private var revealing = false
    @State private var showLoading = false

    private var canReveal: Bool { minimumElapsed && destinationReady }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Theme.background
                    .opacity(revealing ? 0 : 1)

                Image("CoveLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 112, height: 112)
                    .scaleEffect(revealing && !reduceMotion ? max(geometry.size.width, geometry.size.height) / 112 * 1.4 : 1)
                    .opacity(revealing ? 0 : 1)
                    .accessibilityHidden(true)

                if showLoading && !destinationReady && !revealing {
                    ProgressView()
                        .tint(Theme.textSecondary)
                        .offset(y: 100)
                        .accessibilityLabel("Opening Cove")
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
        }
        .ignoresSafeArea()
        .task {
            do {
                try await Task.sleep(for: .milliseconds(350))
                minimumElapsed = true
                try await Task.sleep(for: .milliseconds(650))
                showLoading = true
            } catch { /* The window closed. */ }
        }
        .task(id: canReveal) {
            guard canReveal else { return }
            let duration = reduceMotion ? 0.2 : 0.75
            withAnimation(.easeInOut(duration: duration)) {
                revealing = true
            }
            do {
                try await Task.sleep(for: .seconds(duration))
                onFinished()
            } catch { /* Preserve the overlay if the destination changes. */ }
        }
    }
}