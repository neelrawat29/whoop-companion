import SwiftUI

@main
struct WhoopCompanionApp: App {
    var body: some Scene {
        WindowGroup {
            WebAppView()
                .ignoresSafeArea(.container, edges: .bottom)
                .background(Theme.background.ignoresSafeArea())
                .preferredColorScheme(.dark)
        }
    }
}
