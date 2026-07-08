import SwiftUI

struct LogView: View {
    @State private var vm = LogViewModel()

    var body: some View {
        Form {
            Section {
                DatePicker("Entry date", selection: $vm.date,
                           in: ...Date(), displayedComponents: .date)
            } header: {
                Text("Date")
            } footer: {
                Text("Log today or edit any past day.")
            }

            Section {
                numberRow("Recovery", unit: "%", value: $vm.recovery,
                          hint: "From your Whoop app.")
                numberRow("HRV", unit: "ms", value: $vm.hrv)
                numberRow("Resting HR", unit: "bpm", value: $vm.rhr)
            } header: {
                Text("Morning — from Whoop")
            } footer: {
                Text("All optional. Leave blank if you don't have a value.")
            }

            Section {
                numberRow("Sleep hours", unit: "h", value: $vm.sleepHours)
                numberRow("Sleep score", unit: "/100", value: $vm.sleepScore)
            } header: {
                Text("Sleep")
            }

            Section {
                Stepper("Energy: \(vm.energy)/10", value: $vm.energy, in: 1...10)
                Stepper("Mood: \(vm.mood)/10", value: $vm.mood, in: 1...10)
                numberRow("Hydration", unit: "L", value: $vm.hydration)
                Stepper("Drinks: \(vm.drinks)", value: $vm.drinks, in: 0...20)
                numberRow("Strain", unit: "0–21", value: $vm.strain,
                          hint: "Whoop strain score for the day.")
            } header: {
                Text("Habits & training")
            } footer: {
                Text("Required: Energy, Mood, Drinks. Others optional.")
            }

            Section {
                Toggle("Set bedtime", isOn: $vm.hasBedtime)
                if vm.hasBedtime {
                    DatePicker("Bedtime", selection: $vm.bedtime, displayedComponents: .hourAndMinute)
                }
                Toggle("Set wake time", isOn: $vm.hasWakeTime)
                if vm.hasWakeTime {
                    DatePicker("Wake time", selection: $vm.wakeTime, displayedComponents: .hourAndMinute)
                }
            } header: {
                Text("Sleep timing")
            } footer: {
                Text("Optional — helps track sleep consistency over time.")
            }

            Section {
                Picker("Work location", selection: $vm.workLocation) {
                    Text("Not set").tag("")
                    Text("Home").tag("home")
                    Text("Office").tag("office")
                    Text("Off / no work").tag("off")
                }
                TextField("One line about today…", text: $vm.note, axis: .vertical)
                    .lineLimit(2...4)
            } header: {
                Text("Context")
            } footer: {
                Text("Optional context to spot patterns in Insights.")
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
                Text(msg).font(.footnote)
                    .foregroundStyle(msg.hasPrefix("Saved") ? .green : .red)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Daily Log")
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }
    }

    @ViewBuilder
    private func numberRow(_ label: String,
                           unit: String? = nil,
                           value: Binding<Double?>,
                           hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label).font(.subheadline)
                Spacer()
                TextField("—", value: value, format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 90)
                if let unit {
                    Text(unit).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let hint {
                Text(hint).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}
