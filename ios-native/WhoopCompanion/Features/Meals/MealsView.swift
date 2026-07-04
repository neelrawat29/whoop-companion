import SwiftUI

struct MealsView: View {
    @State private var vm = MealsViewModel()
    @State private var showingAdd = false

    var body: some View {
        List {
            Section("Date") {
                DatePicker("Date", selection: $vm.date, displayedComponents: .date)
            }
            ForEach(["breakfast", "lunch", "dinner", "snack"], id: \.self) { slot in
                Section(slot.capitalized) {
                    let items = vm.meals.filter { $0.slot == slot }
                    if items.isEmpty {
                        Text("None").foregroundStyle(.secondary)
                    } else {
                        ForEach(items) { m in
                            VStack(alignment: .leading) {
                                Text(m.description)
                                if let k = m.kcal {
                                    Text("\(Int(k)) kcal • P\(Int(m.proteinG ?? 0)) C\(Int(m.carbsG ?? 0)) F\(Int(m.fatG ?? 0))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .onDelete { idx in Task { await vm.delete(slot: slot, offsets: idx) } }
                    }
                }
            }
        }
        .navigationTitle("Meals")
        .toolbar {
            Button { showingAdd = true } label: { Image(systemName: "plus") }
        }
        .sheet(isPresented: $showingAdd) {
            AddMealSheet(vm: vm)
        }
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }
    }
}

struct AddMealSheet: View {
    let vm: MealsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var slot = "breakfast"
    @State private var description = ""
    @State private var kcal: Double?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Slot", selection: $slot) {
                    ForEach(["breakfast", "lunch", "dinner", "snack"], id: \.self) { Text($0.capitalized).tag($0) }
                }
                TextField("Description", text: $description, axis: .vertical).lineLimit(2...5)
                HStack {
                    Text("Calories")
                    Spacer()
                    TextField("—", value: $kcal, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 100)
                }
            }
            .navigationTitle("Add meal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        isSaving = true
                        Task {
                            await vm.add(slot: slot, description: description, kcal: kcal)
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(description.isEmpty || isSaving)
                }
            }
        }
    }
}
