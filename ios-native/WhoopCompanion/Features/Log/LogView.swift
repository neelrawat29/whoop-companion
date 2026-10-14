import SwiftUI

struct LogView: View {
    @State private var vm = LogViewModel()
    @State private var toast: ToastMessage?
    @State private var justSaved: Bool = false

    var body: some View {

        Form {
            if let banner = vm.healthBanner {
                Section {
                    Label(banner, systemImage: "heart.text.square.fill")
                        .font(.footnote)
                        .foregroundStyle(.pink)
                }
            }
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
                numberRow("Hydration", unit: "ml", value: $vm.hydration,
                          hint: waterHint)
                waterChips
                Stepper("Drinks: \(vm.drinks)", value: $vm.drinks, in: 0...20)
                numberRow("Strain", unit: "0–21", value: $vm.strain,
                          hint: "Whoop strain score for the day.")
            } header: {
                Text("Habits & training")
            } footer: {
                Text("All optional — fill in what you have.")
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
                    Task { await handleSave() }
                } label: {
                    HStack {
                        Spacer()
                        if vm.isSaving {
                            ProgressView()
                        } else if justSaved {
                            Label("Saved", systemImage: "checkmark.circle.fill")
                                .fontWeight(.semibold)
                        } else {
                            Text("Save entry").fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(vm.isSaving)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .toast($toast)
        .navigationTitle("Daily Log")
        .task { await vm.load() }
        .onChange(of: vm.date) { _, _ in Task { await vm.load() } }
    }

    private func handleSave() async {
        await vm.save()
        if let status = vm.status, status.hasPrefix("Saved") {
            Haptics.success()
            toast = ToastMessage(kind: .success, text: "Entry saved")
            justSaved = true
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            withAnimation { justSaved = false }
        } else if let status = vm.status {
            Haptics.error()
            toast = ToastMessage(kind: .error, text: status)
        }
    }


    private var waterHint: String {
        let t = vm.waterTarget
        var s = String(format: "Recommended today: %.1f L", Double(t.targetMl) / 1000)
        if t.strainBonusMl > 0 { s += " (incl. +\(t.strainBonusMl) ml for strain)" }
        return s
    }

    private var waterChips: some View {
        let t = vm.waterTarget
        let current = Int(vm.hydration ?? 0)
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(WaterTarget.quickAdds, id: \.ml) { q in
                    Button("+\(q.ml)") {
                        Haptics.tap()
                        vm.hydration = Double(current + q.ml)
                    }
                    .buttonStyle(.bordered).controlSize(.small)
                }
                Button("Hit target") {
                    Haptics.tap()
                    vm.hydration = Double(t.targetMl)
                }
                .buttonStyle(.borderedProminent).controlSize(.small)
                .disabled(current >= t.targetMl)
            }
        }
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
