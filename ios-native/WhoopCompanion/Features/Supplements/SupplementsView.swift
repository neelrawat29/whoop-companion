import SwiftUI

struct SupplementsView: View {
    @State private var vm = SupplementsViewModel()
    @State private var showingAdd = false

    var body: some View {
        List {
            Section {
                if vm.items.isEmpty {
                    Text("No supplements yet — tap + to add your first.")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                } else {
                    ForEach(vm.items) { s in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(s.name).font(.headline)
                            if let brand = s.brand, !brand.isEmpty {
                                Text(brand).font(.caption).foregroundStyle(.secondary)
                            }
                            if let serving = s.servingSize, !serving.isEmpty {
                                Text("Serving: \(serving)").font(.caption).foregroundStyle(.secondary)
                            }
                            if s.calories != nil || s.proteinG != nil || s.carbsG != nil || s.fatG != nil {
                                HStack(spacing: 12) {
                                    if let k = s.calories { Text("\(Int(k)) kcal") }
                                    if let p = s.proteinG { Text("P \(Int(p))g") }
                                    if let c = s.carbsG { Text("C \(Int(c))g") }
                                    if let f = s.fatG { Text("F \(Int(f))g") }
                                }
                                .font(.caption2).foregroundStyle(.secondary)
                            }
                            if let notes = s.notes, !notes.isEmpty {
                                Text(notes).font(.caption).italic()
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .onDelete { idx in Task { await vm.delete(offsets: idx) } }
                }
            } header: {
                Text("Your supplements")
            } footer: {
                Text("These appear as chips when you log habits so you can mark what you took each day.")
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Supplements")
        .toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showingAdd) { AddSupplementSheet(vm: vm) }
        .task { await vm.load() }
    }
}

struct AddSupplementSheet: View {
    let vm: SupplementsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var brand = ""
    @State private var servingSize = ""
    @State private var notes = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    labeledText("Name", placeholder: "e.g. Creatine Monohydrate",
                                required: true, text: $name)
                    labeledText("Brand", placeholder: "Optional", text: $brand)
                    labeledText("Serving size",
                                placeholder: "e.g. 1 scoop (5g)", text: $servingSize)
                } header: {
                    Text("Basics")
                } footer: {
                    Text("Only the name is required.")
                }

                Section {
                    macroRow("Calories", unit: "kcal", text: $calories, keyboard: .numberPad)
                    macroRow("Protein", unit: "g", text: $protein)
                    macroRow("Carbs", unit: "g", text: $carbs)
                    macroRow("Fat", unit: "g", text: $fat)
                } header: {
                    Text("Per serving")
                } footer: {
                    Text("Optional — used when computing daily intake if this supplement adds macros.")
                }

                Section("Notes") {
                    TextField("Optional notes (dose, timing…)", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Add supplement")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await vm.add(
                                name: name,
                                brand: brand.isEmpty ? nil : brand,
                                servingSize: servingSize.isEmpty ? nil : servingSize,
                                notes: notes.isEmpty ? nil : notes,
                                calories: Double(calories),
                                proteinG: Double(protein),
                                carbsG: Double(carbs),
                                fatG: Double(fat)
                            )
                            dismiss()
                        }
                    }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    @ViewBuilder
    private func labeledText(_ label: String, placeholder: String,
                             required: Bool = false,
                             text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(label).font(.subheadline)
                Text(required ? "Required" : "Optional")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 5).padding(.vertical, 1.5)
                    .background((required ? Theme.accent : Color.secondary).opacity(0.15), in: Capsule())
                    .foregroundStyle(required ? Theme.accent : .secondary)
                Spacer()
            }
            TextField(placeholder, text: text)
        }
    }

    @ViewBuilder
    private func macroRow(_ label: String, unit: String,
                          text: Binding<String>,
                          keyboard: UIKeyboardType = .decimalPad) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            TextField("—", text: text)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
            Text(unit).font(.caption).foregroundStyle(.secondary)
        }
    }
}
