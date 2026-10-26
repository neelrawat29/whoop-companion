import SwiftUI
import Supabase

/// One-question-at-a-time setup shown to new accounts. Mirrors the web /onboarding page and
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

    static let totalSteps = 8

    /// Steps: 1 goal, 2 activity, 3 sex, 4 birth year, 5 height, 6 weight, 7 WHOOP, 8 targets.
    var currentError: String? {
        switch step {
        case 1: return goal == nil ? "Choose a goal" : nil
        case 2: return activity == nil ? "Choose an activity level" : nil
        case 3: return sex == nil ? "Choose one" : nil
        case 4: return birthYearError
        case 5: return heightError
        case 6: return weightError
        default: return nil
        }
    }

    @MainActor
    func next() async {
        errorMessage = nil
        if currentError != nil { showErrors = true; Haptics.warning(); return }
        if step == 6 {
            guard step1Valid, step2Valid, let b = body("save") else { showErrors = true; Haptics.warning(); return }
            isBusy = true; defer { isBusy = false }
            do { targets = try await APIClient.shared.callAPI(path: "onboarding", body: b, as: Targets.self) }
            catch { errorMessage = "Couldn't save your details. Please try again."; return }
        }
        showErrors = false
        withAnimation(.easeInOut(duration: 0.25)) { step = min(Self.totalSteps, step + 1) }
    }

    /// Option taps record the answer, then move on automatically.
    @MainActor
    func pick(_ apply: () -> Void) {
        Haptics.tap(); apply()
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(280))
            await self.next()
        }
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

    private struct Option { let value: String; let label: String; let hint: String?; let icon: String; let color: Color }

    private let goals: [Option] = [
        Option(value: "lose", label: "Lose fat", hint: "Eat a little under your burn", icon: "arrow.down.right", color: Theme.accent),
        Option(value: "maintain", label: "Maintain", hint: "Eat at your burn rate", icon: "equal", color: Theme.water),
        Option(value: "gain", label: "Build muscle", hint: "Eat a little over your burn", icon: "dumbbell", color: Theme.recovery),
    ]
    private let activities: [Option] = [
        Option(value: "sedentary", label: "Sedentary", hint: "Desk job, little exercise", icon: "chair.lounge", color: Theme.sleep),
        Option(value: "light", label: "Light", hint: "Exercise 1–3 days a week", icon: "figure.walk", color: Theme.water),
        Option(value: "moderate", label: "Moderate", hint: "Exercise 3–5 days a week", icon: "figure.run", color: Theme.recovery),
        Option(value: "active", label: "Active", hint: "Hard exercise 6–7 days a week", icon: "bolt", color: Theme.amber),
        Option(value: "very_active", label: "Very active", hint: "Physical job or twice-daily training", icon: "flame", color: Theme.accent),
    ]
    private let sexes: [Option] = [
        Option(value: "male", label: "Male", hint: nil, icon: "person", color: Theme.sleep),
        Option(value: "female", label: "Female", hint: nil, icon: "person", color: Theme.protein),
        Option(value: "other", label: "Other", hint: nil, icon: "person.2", color: Theme.water),
    ]

    private var isOptionStep: Bool { (1...3).contains(vm.step) }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    SwiftUI.Group {
                        switch vm.step {
                        case 1: optionStep("What are you working towards?", "This sets whether Cove aims you below, at or above your daily burn.", goals, selected: vm.goal) { v in vm.goal = v }
                        case 2: optionStep("How active are you?", "Your typical week, outside of today.", activities, selected: vm.activity) { v in vm.activity = v }
                        case 3: optionStep("What's your sex?", "Used in the resting-calorie formula and your water target.", sexes, selected: vm.sex, grid: true) { v in vm.sex = v }
                        case 4: numberStep("What year were you born?", "Your resting burn changes with age.", text: $vm.birthYear, placeholder: "1990", unit: nil, keyboard: .numberPad, showHealth: true)
                        case 5: numberStep("How tall are you?", "Height feeds your resting-calorie estimate.", text: $vm.heightCm, placeholder: "175", unit: "cm", keyboard: .decimalPad, showHealth: false)
                        case 6: numberStep("What do you weigh?", "Sets your protein (1.8 g per kg) and water targets.", text: $vm.weightKg, placeholder: "72", unit: "kg", keyboard: .decimalPad, showHealth: false)
                        case 7: stepWhoop
                        default: stepTargets
                        }
                    }
                    .id(vm.step)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))

                    if vm.showErrors, let e = vm.currentError {
                        Text(e).font(Theme.body(.footnote)).foregroundStyle(Theme.danger)
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
                Image("CoveLogo").resizable().scaledToFit().frame(width: 36, height: 36).accessibilityHidden(true)
                Text("Cove").font(Theme.body(.headline))
                Spacer()
                Text("\(vm.step) of \(OnboardingViewModel.totalSteps)").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            }
            HStack(spacing: 4) {
                ForEach(1...OnboardingViewModel.totalSteps, id: \.self) { i in
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
                Button {
                    vm.showErrors = false
                    withAnimation { vm.step -= 1 }
                } label: { Label("Back", systemImage: "chevron.left") }
            }
            Spacer()
            if !isOptionStep {
                Button {
                    Task {
                        if vm.step < OnboardingViewModel.totalSteps { await vm.next() }
                        else if await vm.finish() { onComplete() }
                    }
                } label: {
                    if vm.isBusy { ProgressView().tint(Theme.onAccent) }
                    else { Text(vm.step == OnboardingViewModel.totalSteps ? "Enter Cove" : "Continue").bold() }
                }
                .buttonStyle(CoveButtonStyle(prominent: true))
                .controlSize(.large)
                .disabled(vm.isBusy)
            }
        }
        .padding(20)
        .frame(minHeight: 60)
        .background(Theme.background)
    }

    private func title(_ t: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(t).font(Theme.heading(.title))
            Text(sub).font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Option questions (auto-advance on tap)

    private func optionStep(_ t: String, _ sub: String, _ options: [Option], selected: String?, grid: Bool = false, set: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            title(t, sub)
            if grid {
                HStack(spacing: 10) {
                    ForEach(options, id: \.value) { o in tile(o, selected: selected == o.value) { vm.pick { set(o.value) } } }
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(options, id: \.value) { o in card(o, selected: selected == o.value) { vm.pick { set(o.value) } } }
                }
            }
            Text("Tap an answer to continue.").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
        }
    }

    private func iconBadge(_ o: Option, size: CGFloat) -> some View {
        Image(systemName: o.icon)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(o.color)
            .frame(width: size, height: size)
            .background(o.color.opacity(0.14), in: Circle())
            .accessibilityHidden(true)
    }

    private func card(_ o: Option, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                iconBadge(o, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(o.label).font(Theme.body(.headline)).foregroundStyle(Theme.textPrimary)
                    if let h = o.hint { Text(h).font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary) }
                }
                Spacer(minLength: 8)
                Image(systemName: selected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundStyle(selected ? Theme.accent : Theme.textSecondary.opacity(0.6))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? o.color.opacity(0.10) : Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(selected ? o.color : Theme.cardBorder, lineWidth: selected ? 2 : 1))
            .shadow(color: Theme.shadow.opacity(0.06), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .disabled(vm.isBusy)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func tile(_ o: Option, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 10) {
                iconBadge(o, size: 56)
                Text(o.label).font(Theme.body(.headline)).foregroundStyle(Theme.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(selected ? o.color.opacity(0.10) : Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(selected ? o.color : Theme.cardBorder, lineWidth: selected ? 2 : 1))
            .shadow(color: Theme.shadow.opacity(0.06), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: Number questions (Continue button)

    private func numberStep(_ t: String, _ sub: String, text: Binding<String>, placeholder: String, unit: String?, keyboard: UIKeyboardType, showHealth: Bool) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            title(t, sub)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField(placeholder, text: text)
                    .keyboardType(keyboard)
                    .font(Theme.number(44))
                    .multilineTextAlignment(.center)
                    .monospacedDigit()
                if let unit { Text(unit).font(Theme.body(.title3)).foregroundStyle(Theme.textSecondary).fixedSize() }
            }
            .padding(.vertical, 22).padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(vm.showErrors && vm.currentError != nil ? Theme.danger : Theme.cardBorder))
            if showHealth {
                Button { Task { await vm.autofillFromHealth() } } label: {
                    Label("Fill from Apple Health", systemImage: "heart.fill")
                }
                .buttonStyle(CoveButtonStyle())
                if let n = vm.healthNote { Text(n).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary) }
            }
            Label("Required so your targets are accurate, not generic.", systemImage: "info.circle")
                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
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
            Text("No WHOOP? Continue now and connect later in Settings.")
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
