import SwiftUI

struct MealsView: View {
    @State private var vm = MealsViewModel()

    private let fixedSlots = ["breakfast", "lunch", "dinner"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                totalsCard

                ForEach(fixedSlots, id: \.self) { slot in
                    MealSlotCard(vm: vm, slot: slot, meal: vm.meal(for: slot))
                }

                snacksCard
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Meals")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Meals").font(.title2.bold())
                Text("AI-estimated, fully editable.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("VIEWING DATE")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    if !Calendar.current.isDateInToday(vm.date) {
                        Button("Today") { vm.date = Date() }
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(Theme.accent.opacity(0.15), in: Capsule())
                            .foregroundStyle(Theme.accent)
                    }
                    DatePicker("", selection: $vm.date,
                               in: ...Date(), displayedComponents: .date)
                        .labelsHidden()
                }
            }
        }
    }

    private var totalsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Day's intake").font(.footnote).foregroundStyle(.secondary)
            Text("\(Int(vm.totalKcal)) kcal").font(.largeTitle.bold())
            HStack(spacing: 24) {
                macro("Protein", value: vm.totalProtein)
                macro("Carbs", value: vm.totalCarbs)
                macro("Fat", value: vm.totalFat)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func macro(_ label: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(String(format: "%.0fg", value)).font(.headline).monospacedDigit()
        }
    }

    private var snacksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Snacks").font(.headline)
                Spacer()
                Button {
                    Task { await vm.addEmptySnack() }
                } label: {
                    Label("Add snack", systemImage: "plus")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            let items = vm.snacks()
            if items.isEmpty {
                Text("No snacks logged yet.")
                    .font(.footnote).foregroundStyle(.secondary)
            } else {
                ForEach(items) { snack in
                    MealSlotCard(vm: vm, slot: "snack", meal: snack, embedded: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}

// MARK: - Slot card with AI estimate

struct MealSlotCard: View {
    let vm: MealsViewModel
    let slot: String
    let meal: Meal?
    var embedded: Bool = false

    @State private var description = ""
    @State private var portionNotes = ""
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var assumptions = ""
    @State private var estimating = false
    @State private var saving = false
    @State private var statusMessage: String?
    @State private var statusIsError = false

    private var isDirty: Bool {
        (meal?.description ?? "") != description
            || (meal?.kcal?.description ?? "") != kcal
            || (meal?.proteinG?.description ?? "") != protein
            || (meal?.carbsG?.description ?? "") != carbs
            || (meal?.fatG?.description ?? "") != fat
    }

    private var placeholder: String {
        switch slot {
        case "breakfast": return "e.g. 2 eggs, sourdough toast, black coffee"
        case "lunch":     return "e.g. chicken caesar salad, sparkling water"
        case "dinner":    return "e.g. grilled salmon, rice, broccoli"
        default:          return "e.g. apple and a handful of almonds"
        }
    }

    var body: some View {
        let content = VStack(alignment: .leading, spacing: 12) {
            if !embedded {
                Text(slot.capitalized).font(.headline)
            }

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel("What did you eat?", required: true,
                           hint: "Be specific about foods and portions for better estimates.")
                TextField(placeholder, text: $description, axis: .vertical)
                    .lineLimit(2...5)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel("Portion notes", hint: "e.g. large bowl ~300g, no oil, double cheese")
                TextField("Optional portion details", text: $portionNotes)
                    .textFieldStyle(.roundedBorder)
            }

            HStack(spacing: 8) {
                Button {
                    Task { await runEstimate(useKcalHint: false) }
                } label: {
                    HStack(spacing: 6) {
                        if estimating { ProgressView().controlSize(.small) }
                        else { Image(systemName: "sparkles") }
                        Text(estimating ? "Estimating…" : "AI estimate")
                    }
                    .font(.footnote.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(estimating || description.trimmingCharacters(in: .whitespaces).isEmpty)

                if !kcal.isEmpty {
                    Button("Re-estimate to my kcal") {
                        Task { await runEstimate(useKcalHint: true) }
                    }
                    .font(.footnote)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(estimating)
                }
                Spacer()
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                NumericField("Calories", unit: "kcal", placeholder: "0", text: $kcal, keyboard: .numberPad)
                NumericField("Protein", unit: "g", placeholder: "0", text: $protein)
                NumericField("Carbs", unit: "g", placeholder: "0", text: $carbs)
                NumericField("Fat", unit: "g", placeholder: "0", text: $fat)
            }

            if !assumptions.isEmpty {
                Text(assumptions)
                    .font(.caption2).italic().foregroundStyle(.secondary)
            }

            HStack {
                Button {
                    Task { await save() }
                } label: {
                    HStack {
                        if saving { ProgressView().controlSize(.small) }
                        Text(meal == nil ? "Save" : (isDirty ? "Save changes" : "Saved"))
                            .font(.footnote.weight(.semibold))
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(saving || (!isDirty && meal != nil))

                if meal != nil {
                    Button(role: .destructive) {
                        Task { if let id = meal?.id { await vm.delete(id: id) } }
                    } label: {
                        Image(systemName: "trash").font(.footnote)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                Spacer()
                if let statusMessage {
                    Text(statusMessage)
                        .font(.caption2)
                        .foregroundStyle(statusIsError ? .red : .green)
                }
            }
        }
        .onAppear(perform: hydrate)
        .onChange(of: meal?.id) { _, _ in hydrate() }

        if embedded {
            content
                .padding(12)
                .background(Theme.background.opacity(0.5),
                            in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(Theme.cardBorder, lineWidth: 1)
                )
        } else {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
        }
    }

    private func hydrate() {
        description = meal?.description ?? ""
        kcal = meal?.kcal.map { String(Int($0)) } ?? ""
        protein = meal?.proteinG.map { String(format: "%g", $0) } ?? ""
        carbs = meal?.carbsG.map { String(format: "%g", $0) } ?? ""
        fat = meal?.fatG.map { String(format: "%g", $0) } ?? ""
        assumptions = ""
        portionNotes = ""
        statusMessage = nil
    }

    private func runEstimate(useKcalHint: Bool) async {
        estimating = true
        defer { estimating = false }
        statusMessage = nil
        do {
            let hint = useKcalHint ? Int(kcal) : nil
            let r = try await MealEstimator.estimate(
                description: description, portionNotes: portionNotes, userKcalHint: hint
            )
            if let k = r.kcal { kcal = String(Int(k)) }
            if let p = r.protein_g { protein = String(format: "%g", p) }
            if let c = r.carbs_g { carbs = String(format: "%g", c) }
            if let f = r.fat_g { fat = String(format: "%g", f) }
            assumptions = r.assumptions ?? ""
            statusIsError = false
            statusMessage = useKcalHint ? "Re-estimated to your kcal" : "Estimated — edit any value"
        } catch {
            statusIsError = true
            statusMessage = "Estimate failed"
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        let ok = await vm.save(
            id: meal?.id,
            slot: slot,
            description: description,
            kcal: Double(kcal),
            protein: Double(protein),
            carbs: Double(carbs),
            fat: Double(fat),
            source: assumptions.isEmpty ? "manual" : "ai"
        )
        statusIsError = !ok
        statusMessage = ok ? "Saved" : "Save failed"
    }
}
