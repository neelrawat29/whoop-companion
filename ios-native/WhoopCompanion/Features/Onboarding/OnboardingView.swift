import SwiftUI
import Supabase

/// Four-step setup shown to new accounts. Mirrors the web /onboarding page and
/// saves through /api/public/ios/onboarding (same validation and formulas).
@Observable
final class OnboardingViewModel {
    var step = 1
    var goal: String?
    var activity: String?
    var sex: String?
    var birthYear = ""
    var heightCm = ""
    var weightKg = ""
    var showErrors = false
    var isBusy = false
    var errorMessage: String?
    var healthNote: String?
    var targets: Targets?

    struct Targets: Decodable { let kcal: Int; let protein_g: Int; let carbs_g: Int; let fat_g: Int; let water_ml: Int }
    private struct Body: Encodable {
        let action: String, goal: String, activity_level: String, sex: String
        let birth_year: Int, height_cm: Double, weight_kg: Double
    }

    // MARK: Validation (same limits as src/lib/onboarding.shared.ts)
    var birthYearError: String? {
        guard let y = Int(birthYear) else { return "Required" }
        let age = Calendar.current.component(.year, from: Date()) - y
        return (16...100).contains(age) ? nil : "Age must be between 16 and 100"
    }
    var heightError: String? {
        guard let h = Double(heightCm.replacingOccurrences(of: ",", with: ".")) else { return "Required" }
        return (100...250).contains(h) ? nil : "Enter 100–250 cm"
    }
    var weightError: String? {
        guard let w = Double(weightKg.replacingOccurrences(of: ",", with: ".")) else { return "Required" }
        return (30...300).contains(w) ? nil : "Enter 30–300 kg"
    }
    var step1Valid: Bool { goal != nil && activity != nil }
    var step2Valid: Bool { sex != nil && birthYearError == nil && heightError == nil && weightError == nil }

    private func body(_ action: String) -> Body? {
        guard let goal, let activity, let sex, let y = Int(birthYear),
              let h = Double(heightCm.replacingOccurrences(of: ",", with: ".")),
              let w = Double(weightKg.replacingOccurrences(of: ",", with: ".")) else { return nil }
        return Body(action: action, goal: goal, activity_level: activity, sex: sex, birth_year: y, height_cm: h, weight_kg: w)
    }

    @MainActor
    func load(userId: UUID) async {
        struct P: Decodable {
            let goal: String?; let activity_level: String?; let sex: String?
            let birth_year: Int?; let height_cm: Double?; let weight_kg: Double?
        }
        if let p: P = try? await SupabaseManager.shared.client.from("profiles")
            .select("goal,activity_level,sex,birth_year,height_cm,weight_kg")
            .eq("id", value: userId).single().execute().value {
            goal = p.goal; activity = p.activity_level; sex = p.sex
            if let v = p.birth_year { birthYear = String(v) }
            if let v = p.height_cm { heightCm = Self.fmt(v) }
            if let v = p.weight_kg { weightKg = Self.fmt(v) }
        }
    }

    /// Fills empty fields from Apple Health; never overwrites what the user typed.
    @MainActor
    func autofillFromHealth() async {
        let hk = HealthKitManager.shared
        guard hk.isAvailable else { healthNote = "Apple Health isn't available on this device."; return }
        _ = await hk.requestAuthorization()
        let b = await hk.profileBasics()
        var filled = 0
        if sex == nil, let v = b.sex { sex = v; filled += 1 }
        if birthYear.isEmpty, let v = b.birthYear { birthYear = String(v); filled += 1 }
        if heightCm.isEmpty, let v = b.heightCm { heightCm = Self.fmt(v); filled += 1 }
        if weightKg.isEmpty, let v = b.weightKg { weightKg = Self.fmt(v); filled += 1 }
        healthNote = filled > 0 ? "Filled \(filled) detail\(filled == 1 ? "" : "s") from Apple Health — check they're right."
                                : "Nothing new found in Apple Health. Please enter your details."
        if filled > 0 { Haptics.success() }
    }

    @MainActor
    func next() async {
        errorMessage = nil
        if step == 1 && !step1Valid { showErrors = true; Haptics.warning(); return }
        if step == 2 {
            guard step2Valid, let b = body("save") else { showErrors = true; Haptics.warning(); return }
            isBusy = true; defer { isBusy = false }
            do { targets = try await APIClient.shared.callAPI(path: "onboarding", body: b, as: Targets.self) }
            catch { errorMessage = "Couldn't save your details. Please try again."; return }
        }
        showErrors = false
        withAnimation { step = min(4, step + 1) }
    }

    @MainActor
    func finish() async -> Bool {
        guard let b = body("complete") else { return false }
        isBusy = true; defer { isBusy = false }
        do {
            targets = try await APIClient.shared.callAPI(path: "onboarding", body: b, as: Targets.self)
            Haptics.success()
            return true
        } catch {
            errorMessage = "Couldn't finish setup. Please try again."
            return false
        }
    }

    private static func fmt(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
    }
}

struct OnboardingView: View {
    let userId: UUID
    let onComplete: () -> Void
    @State private var vm = OnboardingViewModel()

    private let goals: [(String, String, String)] = [
        ("lose", "Lose fat", "500 kcal daily deficit"),
        ("maintain", "Maintain", "Eat at your burn rate"),
        ("gain", "Build muscle", "300 kcal daily surplus"),
    ]
    private let activities: [(String, String, String)] = [
        ("sedentary", "Sedentary", "Desk job, little exercise"),
        ("light", "Light", "Exercise 1–3 days a week"),
        ("moderate", "Moderate", "Exercise 3–5 days a week"),
        ("active", "Active", "Hard exercise 6–7 days a week"),
        ("very_active", "Very active", "Physical job or twice-daily training"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    switch vm.step {
                    case 1: stepGoal
                    case 2: stepBody
                    case 3: stepWhoop
                    default: stepTargets
                    }
                    if let e = vm.errorMessage {
                        Text(e).font(Theme.body(.footnote)).foregroundStyle(Theme.danger)
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .background(Theme.background.ignoresSafeArea())
        .keyboardDoneToolbar()
        .task { await vm.load(userId: userId) }
    }

    // MARK: Chrome

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Cove").font(Theme.body(.headline))
                Spacer()
                Text("Step \(vm.step) of 4").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            }
            HStack(spacing: 6) {
                ForEach(1...4, id: \.self) { i in
                    Capsule().fill(i <= vm.step ? Theme.accent : Theme.cardBorder).frame(height: 4)
                }
            }
            .accessibilityHidden(true)
        }
        .padding(.horizontal, 20).padding(.top, 12)
    }

    private var footer: some View {
        HStack {
            if vm.step > 1 {
                Button { withAnimation { vm.step -= 1 } } label: { Label("Back", systemImage: "chevron.left") }
            }
            Spacer()
            Button {
                Task {
                    if vm.step < 4 { await vm.next() }
                    else if await vm.finish() { onComplete() }
                }
            } label: {
                if vm.isBusy { ProgressView().tint(Theme.onAccent) }
                else { Text(vm.step == 4 ? "Enter Cove" : vm.step == 3 ? "Continue" : "Next").bold() }
            }
            .buttonStyle(CoveButtonStyle(prominent: true))
            .controlSize(.large)
            .disabled(vm.isBusy)
        }
        .padding(20)
        .background(Theme.background)
    }

    private func choice(_ label: String, hint: String?, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap(); action()
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(Theme.body(.subheadline).weight(.medium)).foregroundStyle(Theme.textPrimary)
                if let hint { Text(hint).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(selected ? Theme.accent.opacity(0.12) : Theme.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? Theme.accent : Theme.cardBorder))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func title(_ t: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(t).font(Theme.heading(.title2))
            Text(sub).font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
        }
    }

    private func err(_ text: String?) -> some View {
        SwiftUI.Group {
            if vm.showErrors, let text { Text(text).font(Theme.body(.caption)).foregroundStyle(Theme.danger) }
        }
    }

    // MARK: Steps

    private var stepGoal: some View {
        VStack(alignment: .leading, spacing: 16) {
            title("What are you working towards?", "Your goal and activity level set your daily calorie target.")
            Text("Goal").font(Theme.body(.subheadline).weight(.semibold))
            ForEach(goals, id: \.0) { g in
                choice(g.1, hint: g.2, selected: vm.goal == g.0) { vm.goal = g.0 }
            }
            err(vm.goal == nil ? "Choose a goal" : nil)
            Text("Activity level").font(Theme.body(.subheadline).weight(.semibold)).padding(.top, 4)
            ForEach(activities, id: \.0) { a in
                choice(a.1, hint: a.2, selected: vm.activity == a.0) { vm.activity = a.0 }
            }
            err(vm.activity == nil ? "Choose an activity level" : nil)
        }
    }

    private var stepBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            title("About you", "All four details are required.")
            VStack(alignment: .leading, spacing: 8) {
                Label("Why these are required", systemImage: "info.circle").font(Theme.body(.subheadline).weight(.semibold))
                Text("Cove uses them so your targets and insights are accurate, not generic:")
                Text("• **Sex & height** — feed the Mifflin–St Jeor formula for the calories your body burns at rest.")
                Text("• **Weight** — sets your water target (35 ml/kg for men, 31 ml/kg for women) and protein (1.8 g/kg) to protect muscle.")
                Text("• **Age** — your resting burn and heart-health baselines change with age.")
            }
            .font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
            .padding(14)
            .background(Theme.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.accent.opacity(0.3)))

            Button {
                Task { await vm.autofillFromHealth() }
            } label: {
                Label("Fill from Apple Health", systemImage: "heart.fill")
            }
            .buttonStyle(CoveButtonStyle())
            if let n = vm.healthNote { Text(n).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary) }

            Text("Sex").font(Theme.body(.subheadline).weight(.semibold))
            HStack(spacing: 8) {
                ForEach([("male", "Male"), ("female", "Female"), ("other", "Other")], id: \.0) { s in
                    choice(s.1, hint: nil, selected: vm.sex == s.0) { vm.sex = s.0 }
                }
            }
            err(vm.sex == nil ? "Choose one" : nil)

            field("Birth year", text: $vm.birthYear, placeholder: "1990", keyboard: .numberPad, error: vm.birthYearError)
            field("Height (cm)", text: $vm.heightCm, placeholder: "175", keyboard: .decimalPad, error: vm.heightError)
            field("Weight (kg)", text: $vm.weightKg, placeholder: "72", keyboard: .decimalPad, error: vm.weightError)
        }
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String, keyboard: UIKeyboardType, error: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(Theme.body(.subheadline).weight(.semibold))
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .textFieldStyle(CoveInputStyle())
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(vm.showErrors && error != nil ? Theme.danger : Theme.cardBorder))
            err(error)
        }
    }

    private var stepWhoop: some View {
        VStack(alignment: .leading, spacing: 16) {
            title("Connect your WHOOP", "Sleep, bedtime, recovery, HRV and strain then fill in automatically — no daily typing.")
            Form { WhoopSection() }
                .coveForm()
                .scrollDisabled(true)
                .frame(height: 260)
                .scrollContentBackground(.hidden)
            Text("No WHOOP? Skip this — you can connect anytime in Settings.")
                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
        }
    }

    private var stepTargets: some View {
        VStack(alignment: .leading, spacing: 16) {
            title("Your daily targets", "Built from your goal, activity and body. You can tweak them later in Settings.")
            if let t = vm.targets {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Calories", systemImage: "flame").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(t.kcal.formatted()).font(Theme.number(40))
                        Text("kcal / day").foregroundStyle(Theme.textSecondary)
                    }
                    HStack(spacing: 8) {
                        macro("Protein", t.protein_g, "1.8 g per kg")
                        macro("Carbs", t.carbs_g, "Training fuel")
                        macro("Fat", t.fat_g, "25% of calories")
                    }
                }
                .padding(16)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))

                VStack(alignment: .leading, spacing: 6) {
                    Label("Water", systemImage: "drop").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(t.water_ml.formatted()).font(Theme.number(32))
                        Text("ml / day").foregroundStyle(Theme.textSecondary)
                    }
                    Text("Rises automatically on hard days: +60 ml per point of WHOOP strain.")
                        .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
            } else {
                ProgressView()
            }
        }
    }

    private func macro(_ label: String, _ grams: Int, _ note: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            Text("\(grams) g").font(Theme.heading(.title3))
            Text(note).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: 10))
    }
}
