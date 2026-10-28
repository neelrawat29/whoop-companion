import SwiftUI

struct BiologicalAgeView: View {
    @State private var result: Double?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
        VStack(spacing: 24) {
            if isLoading {
                ProgressView("Computing…")
            } else if let result {
                VStack(spacing: 8) {
                    Text(String(format: "%.1f", result))
                        .font(Theme.number(54, relativeTo: .largeTitle))
                        .padding(.vertical, 12)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(Theme.accent)
                    Text("Estimated biological age (years)")
                        .foregroundStyle(Theme.textSecondary)
                }
                .card()
            } else if errorMessage != nil {
                ContentUnavailableView("Not enough data yet", systemImage: "sparkles",
                    description: Text("Add your date of birth, height and weight in Settings and log a few days to get your biological age."))
            } else {
                ContentUnavailableView("Not enough data yet", systemImage: "sparkles",
                    description: Text("Log a few more days to unlock your estimate."))
            }

            Button("Recalculate") {
                Task { await load() }
            }
            .buttonStyle(CoveButtonStyle(prominent: true))
        }
        .padding()
        .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Biological Age")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        struct Empty: Encodable {}
        struct Result: Decodable { let result: Double?
            let biologicalAge: Double? }
        do {
            // Server fn name/route may differ; adjust to your deployment.
            let r: Result = try await APIClient.shared.callServerFn(name: "biological-age", body: Empty())
            result = r.biologicalAge ?? r.result
        } catch {
            errorMessage = "Failed: \(error.localizedDescription). If this endpoint isn't reachable from the app, we can port the calc client-side."
        }
    }
}
