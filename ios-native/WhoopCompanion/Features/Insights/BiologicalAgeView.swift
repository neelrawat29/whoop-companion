import SwiftUI

struct BiologicalAgeView: View {
    @State private var result: Double?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            if isLoading {
                ProgressView("Computing…")
            } else if let result {
                VStack(spacing: 8) {
                    Text(String(format: "%.1f", result))
                        .font(.system(size: 72, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.accent)
                    Text("Estimated biological age (years)")
                        .foregroundStyle(.secondary)
                }
                .card()
            } else if let errorMessage {
                Text(errorMessage).foregroundStyle(.red).padding()
            }

            Button("Recalculate") {
                Task { await load() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .navigationTitle("Biological Age")
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        struct Empty: Encodable {}
        struct Result: Decodable { let result: Double? ; let biologicalAge: Double? }
        do {
            // Server fn name/route may differ; adjust to your deployment.
            let r: Result = try await APIClient.shared.callServerFn(name: "biological-age", body: Empty())
            result = r.biologicalAge ?? r.result
        } catch {
            errorMessage = "Failed: \(error.localizedDescription). If this endpoint isn't reachable from the app, we can port the calc client-side."
        }
    }
}
