import SwiftUI

struct SupplementsView: View {
    @State private var vm = SupplementsViewModel()
    @State private var showingAdd = false

    var body: some View {
        List {
            if vm.items.isEmpty {
                Text("No supplements yet").foregroundStyle(.secondary)
            } else {
                ForEach(vm.items) { s in
                    VStack(alignment: .leading) {
                        Text(s.name).font(.headline)
                        if let brand = s.brand { Text(brand).font(.caption).foregroundStyle(.secondary) }
                        if let notes = s.notes, !notes.isEmpty {
                            Text(notes).font(.caption)
                        }
                    }
                }
                .onDelete { idx in Task { await vm.delete(offsets: idx) } }
            }
        }
        .navigationTitle("Supplements")
        .toolbar { Button { showingAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showingAdd) { AddSupplementSheet(vm: vm) }
        .task { await vm.load() }
    }
}

struct AddSupplementSheet: View {
    let vm: SupplementsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""; @State private var brand = ""
    @State private var servingSize = ""; @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Brand", text: $brand)
                TextField("Serving size", text: $servingSize)
                TextField("Notes", text: $notes, axis: .vertical).lineLimit(2...4)
            }
            .navigationTitle("Add supplement")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await vm.add(name: name, brand: brand.isEmpty ? nil : brand,
                                         servingSize: servingSize.isEmpty ? nil : servingSize,
                                         notes: notes.isEmpty ? nil : notes)
                            dismiss()
                        }
                    }.disabled(name.isEmpty)
                }
            }
        }
    }
}
