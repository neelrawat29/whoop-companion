import SwiftUI

private let timesOfDay: [(key: String, label: String, symbol: String)] = [
    ("morning", "Morning", "sunrise.fill"),
    ("afternoon", "Afternoon", "sun.max.fill"),
    ("evening", "Evening", "sunset.fill"),
    ("night", "Night", "moon.fill"),
    ("anytime", "Anytime", "clock.fill")
]

private func timeMeta(_ key: String?) -> (label: String, symbol: String)? {
    guard let key = key, let m = timesOfDay.first(where: { $0.key == key }) else { return nil }
    return (m.label, m.symbol)
}

struct SupplementsView: View {
    @State private var vm = SupplementsViewModel()
    @State private var showingAdd = false

    private var grouped: [(header: String, symbol: String?, items: [UserSupplement])] {
        let anyTagged = vm.items.contains { $0.timeOfDay != nil }
        if !anyTagged { return [("All", nil, vm.items)] }
        var out: [(String, String?, [UserSupplement])] = []
        for t in timesOfDay {
            let group = vm.items.filter { ($0.timeOfDay ?? "anytime") == t.key }
            if !group.isEmpty { out.append((t.label, t.symbol, group)) }
        }
        return out
    }

    var body: some View {
        List {
            if vm.items.isEmpty {
                Section {
                    Text("No supplements yet — tap + to add your first.")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                }
            } else {
                ForEach(grouped, id: \.header) { group in
                    Section {
                        ForEach(group.items) { s in
                            row(for: s)
                        }
                        .onDelete { idx in
                            Task {
                                let ids = idx.map { group.items[$0].id }
                                let mapped = IndexSet(vm.items.enumerated().filter { ids.contains($0.element.id) }.map { $0.offset })
                                await vm.delete(offsets: mapped)
                            }
                        }
                    } header: {
                        HStack(spacing: 6) {
                            if let sym = group.symbol { Image(systemName: sym) }
                            Text(group.header)
                        }
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Supplements")
        .toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showingAdd) { AddSupplementSheet(vm: vm) }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    @ViewBuilder
    private func row(for s: UserSupplement) -> some View {
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
            HStack(spacing: 6) {
                if let stat = vm.stats[s.id], stat.loggedDays30 >= 3 {
                    let tint: Color = stat.adherencePct30 >= 80 ? .green : stat.adherencePct30 >= 50 ? .yellow : .red
                    Label("\(stat.adherencePct30)% · 30d", systemImage: "checkmark.circle.fill")
                        .font(.caption2).labelStyle(.titleAndIcon)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(tint.opacity(0.15), in: Capsule())
                        .foregroundStyle(tint)
                }
                if let stat = vm.stats[s.id], stat.streakDays >= 2 {
                    Label("\(stat.streakDays)d", systemImage: "flame.fill")
                        .font(.caption2)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.orange.opacity(0.15), in: Capsule())
                        .foregroundStyle(.orange)
                }
            }
            if let notes = s.notes, !notes.isEmpty {
                Text(notes).font(.caption).italic()
            }
        }
        .padding(.vertical, 2)
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
    @State private var timeOfDay: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    labeledText("Name", placeholder: "e.g. Creatine Monohydrate",
                                required: true, text: $name)
                    labeledText("Brand", placeholder: "Optional", text: $brand)
                    labeledText("Serving size",
                                placeholder: "e.g. 1 scoop (5g)", text: $servingSize)
                    Picker("Time of day", selection: $timeOfDay) {
                        Text("Not set").tag("")
                        ForEach(timesOfDay, id: \.key) { t in
                            Text(t.label).tag(t.key)
                        }
                    }
                } header: {
                    Text("Basics")
                } footer: {
                    Text("Only the name is required. Time of day groups your list on the main screen.")
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
                                fatG: Double(fat),
                                timeOfDay: timeOfDay.isEmpty ? nil : timeOfDay
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
