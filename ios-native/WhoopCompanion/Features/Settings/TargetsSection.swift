import SwiftUI

/// Goal, pace and daily targets — same formulas as the web (computed on Cove's server).
@Observable
final class TargetsViewModel {
    var goal = "maintain"
    var pace = "standard"
    var activity = "moderate"
    var kcal = ""
    var burn = ""
    var protein = ""
    var carbs = ""
    var fat = ""
    var sleep = ""
    var preview: String?
    var status: String?
    var isBusy = false

    private let client = SupabaseManager.shared.client

    struct Computed: Decodable {
        let kcal: Int; let burn_kcal: Int; let protein_g: Int; let carbs_g: Int; let fat_g: Int
        let tdee_source: String?
    }
    struct Payload: Decodable {
        let goal: String?; let goal_pace: String?; let activity_level: String?
        let kcal_target: Int?; let kcal_burn_target: Int?
        let protein_target: Int?; let carbs_target: Int?; let fat_target: Int?
        let sleep_target_hours: Double?
        let computed: Computed?
    }

    func load() async {
        do {
            let p = try await APIClient.shared.getAPI(path: "targets", as: Payload.self)
            goal = p.goal ?? "maintain"; pace = p.goal_pace ?? "standard"
            activity = p.activity_level ?? "moderate"
            kcal = p.kcal_target.map(String.init) ?? ""
            burn = p.kcal_burn_target.map(String.init) ?? ""
            protein = p.protein_target.map(String.init) ?? ""
            carbs = p.carbs_target.map(String.init) ?? ""
            fat = p.fat_target.map(String.init) ?? ""
            sleep = p.sleep_target_hours.map { String(format: "%g", $0) } ?? "8"
            describe(p.computed)
        } catch { status = "Couldn't load targets." }
    }

    private func describe(_ c: Computed?) {
        guard let c else { preview = "Add sex, birth date, height and weight above to auto-compute."; return }
        let src = c.tdee_source == "wearable" ? "from your WHOOP burn" : "estimated"
        let d = c.kcal - c.burn_kcal
        preview = "Maintenance \(c.burn_kcal) kcal (\(src)) · eat \(c.kcal) kcal (\(d >= 0 ? "+" : "")\(d)/day)"
    }

    private func userId() async -> UUID? { try? await client.auth.session.user.id }

    /// Saves goal/pace/activity, then fills every target from the server's formula.
    func autoCompute() async {
        isBusy = true; defer { isBusy = false }
        guard let id = await userId() else { return }
        struct G: Encodable { let goal: String; let goal_pace: String; let activity_level: String }
        do {
            try await client.from("profiles").update(G(goal: goal, goal_pace: pace, activity_level: activity))
                .eq("id", value: id).execute()
            let p = try await APIClient.shared.getAPI(path: "targets", as: Payload.self)
            guard let c = p.computed else { describe(nil); return }
            kcal = String(c.kcal); burn = String(c.burn_kcal)
            protein = String(c.protein_g); carbs = String(c.carbs_g); fat = String(c.fat_g)
            describe(c)
            await save()
        } catch { status = "Auto-compute failed." }
    }

    func save() async {
        isBusy = true; defer { isBusy = false }
        guard let id = await userId() else { return }
        struct U: Encodable {
            let goal: String; let goal_pace: String; let activity_level: String
            let kcal_target: Int?; let kcal_burn_target: Int?
            let protein_target: Int?; let carbs_target: Int?; let fat_target: Int?
            let sleep_target_hours: Double?
        }
        do {
            try await client.from("profiles").update(U(
                goal: goal, goal_pace: pace, activity_level: activity,
                kcal_target: Int(kcal), kcal_burn_target: Int(burn),
                protein_target: Int(protein), carbs_target: Int(carbs), fat_target: Int(fat),
                sleep_target_hours: Double(sleep)
            )).eq("id", value: id).execute()
            status = "Targets saved ✓"; Haptics.success()
        } catch { status = "Save failed: \(error.localizedDescription)" }
    }
}

struct TargetsSection: View {
    @State private var vm = TargetsViewModel()

    var body: some View {
        Section {
            Picker("Goal", selection: $vm.goal) {
                Text("Lose fat").tag("lose")
                Text("Maintain").tag("maintain")
                Text("Build muscle").tag("gain")
            }
            if vm.goal != "maintain" {
                Picker("Pace", selection: $vm.pace) {
                    Text(vm.goal == "gain" ? "Lean" : "Gentle").tag("gentle")
                    Text("Standard").tag("standard")
                    Text("Aggressive").tag("aggressive")
                }
            }
            Picker("Activity", selection: $vm.activity) {
                Text("Sedentary").tag("sedentary")
                Text("Light").tag("light")
                Text("Moderate").tag("moderate")
                Text("Active").tag("active")
                Text("Very active").tag("very_active")
            }
            LabeledNumber("Eaten target", unit: "kcal", text: $vm.kcal)
            LabeledNumber("Burn target", unit: "kcal", text: $vm.burn)
            LabeledNumber("Protein", unit: "g", text: $vm.protein)
            LabeledNumber("Carbs", unit: "g", text: $vm.carbs)
            LabeledNumber("Fat", unit: "g", text: $vm.fat)
            LabeledNumber("Sleep", unit: "h", text: $vm.sleep)
            HStack {
                Button("Auto-compute") { Task { await vm.autoCompute() } }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Save targets") { Task { await vm.save() } }
                    .buttonStyle(.borderedProminent)
            }
            .disabled(vm.isBusy)
            if let s = vm.status {
                Text(s).font(.footnote).foregroundStyle(s.hasSuffix("✓") ? .green : .red)
            }
        } header: {
            Text("Daily targets")
        } footer: {
            Text(vm.preview ?? "Auto-compute uses your body stats, goal and pace — and your real WHOOP burn when available.")
        }
        .task { await vm.load() }
    }
}
