import SwiftUI
import PhotosUI
import UIKit

struct MealsView: View {
    @State private var vm = MealsViewModel()

    private let fixedSlots = ["breakfast", "lunch", "dinner"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if let err = vm.errorMessage {
                    ErrorBanner(message: friendlyError(err),
                                onRetry: { Task { vm.errorMessage = nil; await vm.load() } },
                                onDismiss: { vm.errorMessage = nil })
                }
                totalsCard

                ForEach(fixedSlots, id: \.self) { slot in
                    MealSlotCard(vm: vm, slot: slot, meal: vm.meal(for: slot))
                }

                snacksCard
            }
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .navigationTitle("Meals")
        .navigationBarTitleDisplayMode(.inline)
        // Tab root with its own in-content header (avoids a doubled "Meals" title).
        .toolbar(.hidden, for: .navigationBar)
        .statusBarBackdrop()
        .refreshable { await vm.load() }
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }

    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Meals").font(Theme.heading(.title2))
                Text("Photo, barcode or type — AI does the rest.")
                    .font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            VStack(alignment: .leading, spacing: 4) {
                Text("VIEWING DATE")
                    .font(Theme.body(.caption2).weight(.semibold))
                    .foregroundStyle(Theme.textSecondary)
                HStack(spacing: 6) {
                    if !Calendar.current.isDateInToday(vm.date) {
                        Button("Today") { vm.date = Date() }
                            .font(Theme.body(.caption).weight(.semibold))
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
            Text("Day's intake").font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
            Text("\(Int(vm.totalKcal)) kcal").font(Theme.heading(.largeTitle))
            HStack(spacing: 16) {
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
            Text(label).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
            Text(String(format: "%.0fg", value)).font(Theme.body(.headline)).monospacedDigit()
        }
    }

    private var snacksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Snacks").font(Theme.body(.headline))
                Spacer()
                Button {
                    Task { await vm.addEmptySnack() }
                } label: {
                    Label("Add snack", systemImage: "plus")
                        .font(Theme.body(.caption).weight(.semibold))
                }
                .buttonStyle(CoveButtonStyle())
                .controlSize(.regular)
            }
            let items = vm.snacks()
            if items.isEmpty {
                Text("No snacks logged yet.")
                    .font(Theme.body(.footnote)).foregroundStyle(Theme.textSecondary)
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

// MARK: - Slot card with AI estimate + photo + barcode + presets

struct MealSlotCard: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
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
    @State private var currentSource: String = "manual"

    // Quick-log entry-point state
    @State private var photoItem: PhotosPickerItem?
    @State private var showScanner = false
    @State private var showBarcodeManual = false
    @State private var barcodeManualCode = ""
    @State private var showPresets = false
    @State private var showRecents = false
    @State private var showSavePreset = false
    @State private var newPresetName = ""

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
                Text(slot.capitalized).font(Theme.body(.headline))
            }

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel("What did you eat?", required: true,
                           hint: "Be specific about foods and portions for better estimates.")
                TextField(placeholder, text: $description, axis: .vertical)
                    .lineLimit(2...5)
                    .textFieldStyle(CoveInputStyle())
            }

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel("Portion notes", hint: "e.g. large bowl ~300g, no oil, double cheese")
                TextField("Optional portion details", text: $portionNotes)
                    .textFieldStyle(CoveInputStyle())
            }

            // Quick-log action row
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Photo", systemImage: "camera")
                            .font(Theme.body(.footnote).weight(.semibold))
                    }
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                    .disabled(estimating)

                    Menu {
                        Button {
                            showScanner = true
                        } label: { Label("Scan barcode", systemImage: "barcode.viewfinder") }
                        Button {
                            barcodeManualCode = ""
                            showBarcodeManual = true
                        } label: { Label("Enter barcode", systemImage: "keyboard") }
                    } label: {
                        Label("Barcode", systemImage: "barcode")
                            .font(Theme.body(.footnote).weight(.semibold))
                    }
                    .menuStyle(.button)
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                    .disabled(estimating)

                    Button {
                        showPresets = true
                    } label: {
                        Label("Presets", systemImage: "bookmark")
                            .font(Theme.body(.footnote).weight(.semibold))
                    }
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                    .disabled(estimating)

                    Button {
                        showRecents = true
                    } label: {
                        Label("Recent", systemImage: "clock.arrow.circlepath")
                            .font(Theme.body(.footnote).weight(.semibold))
                    }
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                    .disabled(estimating)
                }
            }

            // AI text estimate + re-estimate
            HStack(spacing: 8) {
                Button {
                    Task { await runEstimate(useKcalHint: false) }
                } label: {
                    HStack(spacing: 6) {
                        if estimating { ProgressView().controlSize(.regular) }
                        else { Image(systemName: "sparkles") }
                        Text(estimating ? "Estimating…" : "AI estimate")
                    }
                    .font(Theme.body(.footnote).weight(.semibold))
                }
                .buttonStyle(CoveButtonStyle(prominent: true))
                .controlSize(.regular)
                .disabled(estimating || description.trimmingCharacters(in: .whitespaces).isEmpty)

                if !kcal.isEmpty {
                    Button("Re-estimate to my kcal") {
                        Task { await runEstimate(useKcalHint: true) }
                    }
                    .font(Theme.body(.footnote))
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                    .disabled(estimating)
                }
                Spacer()
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: dynamicTypeSize.isAccessibilitySize ? 1 : 2), spacing: 10) {
                NumericField("Calories", unit: "kcal", placeholder: "0", text: $kcal, keyboard: .numberPad)
                NumericField("Protein", unit: "g", placeholder: "0", text: $protein)
                NumericField("Carbs", unit: "g", placeholder: "0", text: $carbs)
                NumericField("Fat", unit: "g", placeholder: "0", text: $fat)
            }

            if !assumptions.isEmpty {
                Text(assumptions)
                    .font(Theme.body(.caption2)).italic().foregroundStyle(Theme.textSecondary)
            }

            HStack {
                Button {
                    Task { await save() }
                } label: {
                    HStack {
                        if saving { ProgressView().controlSize(.regular) }
                        Text(meal == nil ? "Save" : (isDirty ? "Save changes" : "Saved"))
                            .font(Theme.body(.footnote).weight(.semibold))
                    }
                }
                .buttonStyle(CoveButtonStyle(prominent: true))
                .controlSize(.regular)
                .disabled(saving || (!isDirty && meal != nil))

                if meal != nil {
                    Button(role: .destructive) {
                        Task { if let id = meal?.id { await vm.delete(id: id) } }
                    } label: {
                        Image(systemName: "trash").font(Theme.body(.footnote))
                    }
                    .buttonStyle(CoveButtonStyle())
                    .controlSize(.regular)
                }

                Button {
                    newPresetName = description.isEmpty ? "New preset" : String(description.prefix(40))
                    showSavePreset = true
                } label: {
                    Image(systemName: "bookmark.circle").font(Theme.body(.footnote))
                }
                .buttonStyle(CoveButtonStyle())
                .controlSize(.regular)
                .disabled(description.isEmpty)

                Spacer()
                if let statusMessage {
                    Text(statusMessage)
                        .font(Theme.body(.caption2))
                        .foregroundStyle(statusIsError ? Theme.danger : Theme.recovery)
                }
            }
        }
        .onAppear(perform: hydrate)
        .onChange(of: meal?.id) { _, _ in hydrate() }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    await runPhotoEstimate(image: image)
                }
                photoItem = nil
            }
        }
        .sheet(isPresented: $showScanner) {
            BarcodeScannerView(onScan: { code in
                showScanner = false
                Task { await runBarcode(code: code) }
            }, onCancel: { showScanner = false })
        }
        .alert("Enter barcode", isPresented: $showBarcodeManual) {
            TextField("e.g. 3017624010701", text: $barcodeManualCode)
                .keyboardType(.numberPad)
            Button("Cancel", role: .cancel) {}
            Button("Look up") { Task { await runBarcode(code: barcodeManualCode) } }
        }
        .sheet(isPresented: $showPresets) {
            PresetsSheet(vm: vm) { preset in
                applyPreset(preset)
                showPresets = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showRecents) {
            RecentsSheet(vm: vm) { recent in
                applyRecent(recent)
                showRecents = false
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .alert("Save as preset", isPresented: $showSavePreset) {
            TextField("Preset name", text: $newPresetName)
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                let name = newPresetName.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                Task {
                    let ok = await vm.savePreset(name: name, description: description,
                                                 kcal: Double(kcal), protein: Double(protein),
                                                 carbs: Double(carbs), fat: Double(fat))
                    statusIsError = !ok
                    statusMessage = ok ? "Preset saved" : "Save failed"
                }
            }
        } message: {
            Text("Locks the current macros so you can log this meal in one tap next time.")
        }

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
        currentSource = meal?.source ?? "manual"
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
            applyEstimate(r, sourceTag: "ai")
            statusIsError = false
            statusMessage = useKcalHint ? "Re-estimated to your kcal" : "Estimated — edit any value"
        } catch {
            statusIsError = true
            statusMessage = shortError(error)
        }
    }

    private func runPhotoEstimate(image: UIImage) async {
        estimating = true
        defer { estimating = false }
        statusMessage = nil
        do {
            let r = try await MealEstimator.estimateFromPhoto(
                image: image, portionNotes: portionNotes, userKcalHint: nil
            )
            if description.trimmingCharacters(in: .whitespaces).isEmpty,
               let d = r.description, !d.isEmpty {
                description = d
            }
            applyEstimate(r, sourceTag: "photo")
            statusIsError = false
            statusMessage = "Estimated from photo — edit any value"
        } catch {
            statusIsError = true
            statusMessage = shortError(error)
        }
    }

    private func runBarcode(code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        let digits = trimmed.filter { $0.isNumber }
        guard digits.count >= 6 else {
            statusIsError = true
            statusMessage = "Enter a valid barcode (6–14 digits)"
            return
        }
        estimating = true
        defer { estimating = false }
        do {
            guard let r = try await BarcodeAPI.lookup(digits) else {
                statusIsError = true
                statusMessage = "Barcode not found"
                return
            }
            let label = [r.brand, r.name].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " — ")
            description = label.isEmpty ? r.name : label
            if let k = r.kcal { kcal = String(Int(k)) }
            if let p = r.proteinG { protein = String(format: "%g", p) }
            if let c = r.carbsG { carbs = String(format: "%g", c) }
            if let f = r.fatG { fat = String(format: "%g", f) }
            if let sg = r.servingG {
                assumptions = "From barcode: \(r.name), per \(Int(sg)) g serving."
            } else {
                assumptions = "From barcode: \(r.name), per 100 g."
            }
            currentSource = "barcode"
            statusIsError = false
            statusMessage = "Prefilled from barcode — edit if needed"
        } catch {
            statusIsError = true
            statusMessage = shortError(error)
        }
    }

    private func applyEstimate(_ r: MealEstimate, sourceTag: String) {
        if let k = r.kcal { kcal = String(Int(k)) }
        if let p = r.protein_g { protein = String(format: "%g", p) }
        if let c = r.carbs_g { carbs = String(format: "%g", c) }
        if let f = r.fat_g { fat = String(format: "%g", f) }
        assumptions = r.assumptions ?? ""
        currentSource = sourceTag
    }

    private func applyPreset(_ p: MealPreset) {
        description = p.description.isEmpty ? p.name : p.description
        kcal = p.kcal.map { String(Int($0)) } ?? ""
        protein = p.proteinG.map { String(format: "%g", $0) } ?? ""
        carbs = p.carbsG.map { String(format: "%g", $0) } ?? ""
        fat = p.fatG.map { String(format: "%g", $0) } ?? ""
        assumptions = "From preset: \(p.name)"
        currentSource = "preset"
        statusIsError = false
        statusMessage = "Prefilled from preset"
    }

    private func applyRecent(_ r: RecentMeal) {
        description = r.description
        kcal = r.kcal.map { String(Int($0)) } ?? ""
        protein = r.proteinG.map { String(format: "%g", $0) } ?? ""
        carbs = r.carbsG.map { String(format: "%g", $0) } ?? ""
        fat = r.fatG.map { String(format: "%g", $0) } ?? ""
        assumptions = "Copied from recent meal."
        currentSource = "manual"
        statusIsError = false
        statusMessage = "Copied from recent"
    }

    private func shortError(_ error: Error) -> String {
        if case let APIError.badResponse(_, msg) = error, !msg.isEmpty {
            return msg.count > 120 ? String(msg.prefix(120)) + "…" : msg
        }
        return error.localizedDescription
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
            source: currentSource
        )
        statusIsError = !ok
        statusMessage = ok ? "Saved" : "Save failed"
    }
}

// MARK: - Sheets

private struct PresetsSheet: View {
    let vm: MealsViewModel
    var onPick: (MealPreset) -> Void

    var body: some View {
        NavigationStack {
            List {
                if vm.presets.isEmpty {
                    Text("No presets yet. Tap the bookmark icon on a saved meal to save one.")
                        .font(Theme.body(.footnote))
                        .foregroundStyle(Theme.textSecondary)
                }
                ForEach(vm.presets) { p in
                    Button {
                        onPick(p)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).font(Theme.body(.body).weight(.semibold))
                            Text(macroLine(p))
                                .font(Theme.body(.caption2))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            Task { await vm.deletePreset(id: p.id) }
                        } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            }
            .coveForm()
            .navigationTitle("Presets")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadPresets() }
        }
    }

    private func macroLine(_ p: MealPreset) -> String {
        let k = p.kcal.map { String(Int($0)) } ?? "?"
        let pr = p.proteinG.map { String(Int($0)) } ?? "?"
        let ca = p.carbsG.map { String(Int($0)) } ?? "?"
        let fa = p.fatG.map { String(Int($0)) } ?? "?"
        return "\(k) kcal · P \(pr) · C \(ca) · F \(fa)"
    }
}

private struct RecentsSheet: View {
    let vm: MealsViewModel
    var onPick: (RecentMeal) -> Void

    var body: some View {
        NavigationStack {
            List {
                if vm.recents.isEmpty {
                    Text("No recent meals yet.")
                        .font(Theme.body(.footnote))
                        .foregroundStyle(Theme.textSecondary)
                }
                ForEach(vm.recents) { r in
                    Button {
                        onPick(r)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.description).font(Theme.body(.body)).lineLimit(2)
                            Text(macroLine(r))
                                .font(Theme.body(.caption2))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
            .coveForm()
            .navigationTitle("Recent meals")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadRecents() }
        }
    }

    private func macroLine(_ r: RecentMeal) -> String {
        let k = r.kcal.map { String(Int($0)) } ?? "?"
        let pr = r.proteinG.map { String(Int($0)) } ?? "?"
        let ca = r.carbsG.map { String(Int($0)) } ?? "?"
        let fa = r.fatG.map { String(Int($0)) } ?? "?"
        return "\(k) kcal · P \(pr) · C \(ca) · F \(fa)"
    }
}
