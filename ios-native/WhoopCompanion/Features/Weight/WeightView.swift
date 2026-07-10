import SwiftUI
import Charts

struct WeightView: View {
    @State private var vm = WeightViewModel()
    @State private var newWeight: Double?
    @State private var newDate: Date = Date()

    var body: some View {
        List {
            Section("Add entry") {
                DatePicker("Date", selection: $newDate, displayedComponents: .date)
                HStack {
                    Text("Weight (kg)")
                    Spacer()
                    TextField("—", value: $newWeight, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 100)
                }
                Button("Add") {
                    Task {
                        if let w = newWeight { await vm.add(weightKg: w, date: newDate); newWeight = nil }
                    }
                }
                .disabled(newWeight == nil)
            }

            Section("Trend") {
                if vm.entries.isEmpty {
                    Text("No entries yet").foregroundStyle(.secondary)
                } else {
                    Chart(vm.entries) { entry in
                        LineMark(
                            x: .value("Date", entry.parsedDate ?? Date()),
                            y: .value("kg", entry.weightKg)
                        )
                        .interpolationMethod(.monotone)
                        PointMark(
                            x: .value("Date", entry.parsedDate ?? Date()),
                            y: .value("kg", entry.weightKg)
                        )
                    }
                    .frame(height: 220)
                }
            }

            Section("History") {
                ForEach(vm.entries) { e in
                    HStack {
                        Text(e.entryDate)
                        Spacer()
                        Text(String(format: "%.1f kg", e.weightKg))
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete { idx in Task { await vm.delete(indices: idx) } }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Weight")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }
}

extension WeightEntry {
    var parsedDate: Date? { DateFormatter.entryDate.date(from: entryDate) }
}
