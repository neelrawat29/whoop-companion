import SwiftUI

// MARK: - DTOs matching /api/public/ios/recap-defaults

struct RecapDefaultsDTO: Codable {
    struct Missing: Codable {
        let metrics: Bool
        let breakfast: Bool
        let lunch: Bool
        let dinner: Bool
        let water: Bool
        let weight: Bool
        let energy: Bool
        let mood: Bool
        let bedtime: Bool
    }
    struct Metrics: Codable {
        let recovery: Double?; let hrv: Double?; let rhr: Double?; let sleep_hours: Double?
    }
    struct Habits: Codable {
        let energy: Int?; let mood: Int?; let hydration: Int?; let bedtime: String?
    }
    struct MealSuggestion: Codable {
        let description: String
        let kcal: Double?; let protein_g: Double?; let carbs_g: Double?; let fat_g: Double?
    }
    struct Current: Codable {
        let metrics: Metrics; let habits: Habits; let weight_kg: Double?
    }
    struct Defaults: Codable {
        let hydration: Int?; let energy: Int?; let mood: Int?; let bedtime: String?
        let weight_kg: Double?; let sleep_target_hours: Double?
        let last_meal_by_slot: [String: MealSuggestion]
    }
    let date: String
    let missing: Missing
    let current: Current
    let defaults: Defaults
}

struct RecapSaveResult: Codable {
    struct Wrote: Codable {
        let metrics: Bool; let habits: Bool; let weight: Bool; let meals: Int
    }
    let ok: Bool; let wrote: Wrote
}

// MARK: - View

struct RecapView: View {
    var onFinished: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var loading = true
    @State private var data: RecapDefaultsDTO?
    @State private var errorMessage: String?
    @State private var saving = false

    // Section toggles
    @State private var includeMetrics = false
    @State private var includeHabits = false
    @State private var includeWeight = false
    @State private var mealChecks: [String: Bool] = [:]

    // Metric fields
    @State private var recovery = ""
    @State private var hrv = ""
    @State private var rhr = ""
    @State private var sleep = ""
    // Habit fields
    @State private var energy = ""
    @State private var mood = ""
    @State private var hydration = ""
    @State private var bedtime = ""
    @State private var weight = ""

    @State private var toast: ToastMessage?

    var body: some View {
        NavigationStack {
            ScrollView {
                if loading {
                    ProgressView().padding(40)
                } else if let msg = errorMessage {
                    Text(msg).foregroundStyle(.red).padding()
                } else if let d = data {
                    content(d)
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("End-of-day recap")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Skip") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(saving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(saving || data == nil)
                }
            }
            .keyboardDoneToolbar()
            .toast($toast)
        }
        .task { await load() }
    }

    @ViewBuilder
    private func content(_ d: RecapDefaultsDTO) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Defaults come from your last 7 days and Apple Health. Uncheck anything you don't want to save.")
                .font(.footnote).foregroundStyle(.secondary)
                .padding(.horizontal)

            if d.missing.metrics {
                sectionCard(title: "Whoop metrics", subtitle: "Recovery, HRV, RHR, sleep",
                            include: $includeMetrics) {
                    Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                        GridRow {
                            NumField(label: "Recovery %", text: $recovery)
                            NumField(label: "HRV (ms)", text: $hrv)
                        }
                        GridRow {
                            NumField(label: "RHR (bpm)", text: $rhr)
                            NumField(label: "Sleep (h)", text: $sleep)
                        }
                    }
                }
            }

            if d.missing.energy || d.missing.mood || d.missing.water || d.missing.bedtime {
                sectionCard(title: "Habits", subtitle: "Prefilled from your 7-day median",
                            include: $includeHabits) {
                    VStack(spacing: 10) {
                        if d.missing.energy { NumField(label: "Energy (1–10)", text: $energy) }
                        if d.missing.mood { NumField(label: "Mood (1–10)", text: $mood) }
                        if d.missing.water { NumField(label: "Hydration (ml)", text: $hydration) }
                        if d.missing.bedtime {
                            HStack {
                                Text("Bedtime").frame(width: 100, alignment: .leading)
                                TextField("HH:MM", text: $bedtime).textFieldStyle(.roundedBorder)
                            }
                        }
                    }
                }
            }

            if d.missing.weight {
                sectionCard(title: "Weight",
                            subtitle: d.defaults.weight_kg.map { "Last: \(String(format: "%.1f", $0)) kg" } ?? "No prior reading",
                            include: $includeWeight) {
                    NumField(label: "Weight (kg)", text: $weight)
                }
            }

            let slots = ["breakfast", "lunch", "dinner"]
            let hasSuggestions = slots.contains(where: { slot in
                missingForSlot(d, slot) && (d.defaults.last_meal_by_slot[slot]) != nil
            })
            if hasSuggestions {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Meals (repeat last week's)").font(.headline)
                    Text("Only shown for slots you haven't logged today.").font(.caption).foregroundStyle(.secondary)
                    ForEach(slots, id: \.self) { slot in
                        if missingForSlot(d, slot), let last = d.defaults.last_meal_by_slot[slot] {
                            Button {
                                mealChecks[slot] = !(mealChecks[slot] ?? false)
                                Haptics.selection()
                            } label: {
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: (mealChecks[slot] ?? false) ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(Theme.accent)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(slot.capitalized).font(.subheadline.weight(.semibold))
                                        Text("\(last.description) · \(last.kcal.map { "\(Int($0)) kcal" } ?? "—")")
                                            .font(.caption).foregroundStyle(.secondary)
                                            .multilineTextAlignment(.leading)
                                    }
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                            .padding(10)
                        }
                    }
                }
                .card()
            }

            if !hasAnythingMissing(d) {
                Text("You've already logged everything for today 🎉")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
    }

    private func missingForSlot(_ d: RecapDefaultsDTO, _ slot: String) -> Bool {
        switch slot {
        case "breakfast": return d.missing.breakfast
        case "lunch": return d.missing.lunch
        case "dinner": return d.missing.dinner
        default: return false
        }
    }

    private func hasAnythingMissing(_ d: RecapDefaultsDTO) -> Bool {
        d.missing.metrics || d.missing.breakfast || d.missing.lunch || d.missing.dinner
            || d.missing.water || d.missing.weight || d.missing.energy || d.missing.mood || d.missing.bedtime
    }

    @ViewBuilder
    private func sectionCard<Content: View>(
        title: String, subtitle: String, include: Binding<Bool>, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("", isOn: include).labelsHidden()
            }
            if include.wrappedValue { content() }
        }
        .card()
    }

    // MARK: - Load / Save

    private func load() async {
        loading = true; defer { loading = false }
        // Pre-fill from HealthKit in parallel with the server call
        async let hk = HealthKitManager.shared.snapshot()
        do {
            let d: RecapDefaultsDTO = try await APIClient.shared.getAPI(path: "recap-defaults", as: RecapDefaultsDTO.self)
            self.data = d
            self.includeMetrics = d.missing.metrics
            self.includeHabits = d.missing.energy || d.missing.mood || d.missing.water || d.missing.bedtime
            self.includeWeight = d.missing.weight && d.defaults.weight_kg != nil
            self.energy = d.defaults.energy.map(String.init) ?? ""
            self.mood = d.defaults.mood.map(String.init) ?? ""
            self.hydration = d.defaults.hydration.map(String.init) ?? ""
            self.bedtime = d.defaults.bedtime ?? ""
            self.weight = d.defaults.weight_kg.map { String(format: "%.1f", $0) } ?? ""
            for slot in ["breakfast", "lunch", "dinner"] {
                let miss = missingForSlot(d, slot)
                let hasSug = (d.defaults.last_meal_by_slot[slot]) != nil
                mealChecks[slot] = miss && hasSug
            }

            // Overlay HealthKit values where the server has no value yet
            let snap = await hk
            if includeMetrics {
                if hrv.isEmpty, let v = snap.hrvMs { hrv = String(Int(v.rounded())) }
                if rhr.isEmpty, let v = snap.rhrBpm { rhr = String(Int(v.rounded())) }
                if sleep.isEmpty, let v = snap.sleepHours { sleep = String(format: "%.1f", v) }
            }
            if includeWeight, weight.isEmpty, let v = snap.weightKg { weight = String(format: "%.1f", v) }
            if includeHabits, hydration.isEmpty, let v = snap.waterMl { hydration = String(Int(v.rounded())) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        guard let _ = data else { return }
        saving = true; defer { saving = false }

        struct Payload: Encodable {
            struct Metrics: Encodable { var recovery: Double?; var hrv: Double?; var rhr: Double?; var sleep_hours: Double? }
            struct Habits: Encodable { var energy: Int?; var mood: Int?; var hydration: Int?; var bedtime: String? }
            struct Meal: Encodable { var slot: String; var description: String; var kcal: Double?; var protein_g: Double?; var carbs_g: Double?; var fat_g: Double? }
            var metrics: Metrics?
            var habits: Habits?
            var weight_kg: Double?
            var meals: [Meal]?
        }

        var p = Payload()
        if includeMetrics {
            p.metrics = .init(
                recovery: Double(recovery), hrv: Double(hrv), rhr: Double(rhr), sleep_hours: Double(sleep)
            )
        }
        if includeHabits {
            p.habits = .init(
                energy: Int(energy), mood: Int(mood), hydration: Int(hydration),
                bedtime: bedtime.isEmpty ? nil : bedtime
            )
        }
        if includeWeight, let w = Double(weight) { p.weight_kg = w }
        var meals: [Payload.Meal] = []
        if let d = data {
            for slot in ["breakfast", "lunch", "dinner"] where mealChecks[slot] ?? false {
                if let last = d.defaults.last_meal_by_slot[slot] {
                    meals.append(.init(slot: slot, description: last.description,
                                       kcal: last.kcal, protein_g: last.protein_g,
                                       carbs_g: last.carbs_g, fat_g: last.fat_g))
                }
            }
        }
        if !meals.isEmpty { p.meals = meals }

        do {
            let res: RecapSaveResult = try await APIClient.shared.callAPI(path: "save-recap", body: p, as: RecapSaveResult.self)
            Haptics.success()
            toast = ToastMessage(kind: .success, text: "Saved (\(res.wrote.meals) meals, metrics: \(res.wrote.metrics ? "yes" : "no"))")
            try? await Task.sleep(nanoseconds: 700_000_000)
            onFinished()
            dismiss()
        } catch {
            Haptics.error()
            toast = ToastMessage(kind: .error, text: "Save failed: \(error.localizedDescription)")
        }
    }
}

private struct NumField: View {
    let label: String
    @Binding var text: String
    var body: some View {
        HStack {
            Text(label).frame(width: 130, alignment: .leading).font(.subheadline)
            TextField("", text: $text)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
        }
    }
}
