import SwiftUI

struct LogView: View {
    @State private var vm = LogViewModel()

    var body: some View {
        Form {
            Section("Date") {
                DatePicker("Entry date", selection: $vm.date, displayedComponents: .date)
            }
            Section("Recovery") {
                numberField("Recovery %", value: $vm.recovery)
                numberField("HRV (ms)", value: $vm.hrv)
                numberField("Resting HR", value: $vm.rhr)
            }
            Section("Sleep") {
                numberField("Sleep hours", value: $vm.sleepHours)
                numberField("Sleep score", value: $vm.sleepScore)
            }
            Section("Habits") {
                Stepper("Energy: \(vm.energy)", value: $vm.energy, in: 1...10)
                Stepper("Mood: \(vm.mood)", value: $vm.mood, in: 1...10)
                numberField("Hydration (L)", value: $vm.hydration)
                Stepper("Drinks: \(vm.drinks)", value: $vm.drinks, in: 0...20)
                TextField("Note", text: $vm.note, axis: .vertical)
                    .lineLimit(2...4)
            }
            Section {
                Button {
                    Task { await vm.save() }
                } label: {
                    if vm.isSaving { ProgressView() }
                    else { Text("Save entry").frame(maxWidth: .infinity) }
                }
                .disabled(vm.isSaving)
            }
            if let msg = vm.status {
                Text(msg).font(.footnote).foregroundStyle(msg.hasPrefix("Saved") ? .green : .red)
            }
        }
        .navigationTitle("Daily Log")
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }
    }

    @ViewBuilder
    private func numberField(_ label: String, value: Binding<Double?>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("—", value: value, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 100)
        }
    }
}
