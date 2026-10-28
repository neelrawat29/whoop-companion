import SwiftUI

struct LogView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var vm = LogViewModel()
    @State private var toast: ToastMessage?
    @State private var justSaved: Bool = false

    var body: some View {

        Form {
            if let s = vm.status, s.hasPrefix("Load failed") {
                Section {
                    ErrorBanner(message: "Couldn't load this day's log. " + friendlyError(String(s.dropFirst("Load failed: ".count)))) {
                        Task { await vm.load() }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            if let banner = vm.healthBanner {
                Section {
                    Label(banner, systemImage: "heart.text.square.fill")
                        .font(Theme.body(.footnote))
                        .foregroundStyle(Theme.protein)
                }
            }
            Section {
                daySummary
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

            Section {
                numberRow("Recovery", unit: "%", value: $vm.recovery,
                          hint: "Fills in automatically when WHOOP is connected.")
                numberRow("HRV", unit: "ms", value: $vm.hrv)
                numberRow("Resting HR", unit: "bpm", value: $vm.rhr)
            } header: {
                sectionHeader("Morning — from WHOOP", icon: "heart.fill", color: Theme.recovery)
            } footer: {
                Text("All optional. Leave blank if you don't have a value.")
            }

            Section {
                if dynamicTypeSize.isAccessibilitySize {
                    numberRow("Hours", unit: "hr", value: sleepHrsBinding)
                    numberRow("Minutes", unit: "min", value: sleepMinBinding)
                } else {
                    HStack(alignment: .top, spacing: 12) {
                        numberRow("Hours", unit: "hr", value: sleepHrsBinding)
                        numberRow("Minutes", unit: "min", value: sleepMinBinding)
                    }
                }
                numberRow("Sleep score", unit: "/100", value: $vm.sleepScore)
                LabeledContent("Bedtime") {
                    Text(vm.hasBedtime ? vm.bedtime.formatted(date: .omitted, time: .shortened) : "—")
                }
                LabeledContent("Wake time") {
                    Text(vm.hasWakeTime ? vm.wakeTime.formatted(date: .omitted, time: .shortened) : "—")
                }
            } header: {
                sectionHeader("Sleep", icon: "bed.double.fill", color: Theme.sleep)
            } footer: {
                Text("Bedtime and wake time come from WHOOP automatically.")
            }

            Section {
                hydrationProgress
                numberRow("Hydration", unit: "ml", value: $vm.hydration,
                          hint: waterHint)
                waterChips
            } header: {
                sectionHeader("Water", icon: "drop.fill", color: Theme.water)
            }

            Section {
                numberRow("Strain", unit: "0–21", value: $vm.strain,
                          hint: "WHOOP strain score for the day.")
                Stepper("Drinks: \(vm.drinks)", value: $vm.drinks, in: 0...20)
            } header: {
                sectionHeader("Activity & habits", icon: "flame.fill", color: Theme.amber)
            } footer: {
                Text("All optional — fill in what you have.")
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
                sectionHeader("Context", icon: "note.text", color: Theme.protein)
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
                .buttonStyle(CoveButtonStyle(prominent: true))
                .controlSize(.large)
                .disabled(vm.isSaving)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .listRowBackground(Color.clear)
            }
        }
        .coveForm()
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .toast($toast)
        .navigationTitle("Daily Log")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .listSectionSpacing(.compact)
        .task { await vm.load() }
        .refreshable {
            struct B: Encodable { let action = "sync" }
            struct R: Decodable { let days: Int }
            _ = try? await APIClient.shared.callAPI(path: "whoop", body: B(), as: R.self)
            await vm.load()
        }
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


    // MARK: Day summary

    private var isToday: Bool { Calendar.current.isDateInToday(vm.date) }

    private func shiftDay(_ by: Int) {
        guard let d = Calendar.current.date(byAdding: .day, value: by, to: vm.date), d <= Date() else { return }
        Haptics.selection()
        vm.date = d
    }

    private var daySummary: some View {
        VStack(spacing: 14) {
            HStack {
                Button { shiftDay(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .accessibilityLabel("Previous day")
                Spacer()
                VStack(spacing: 2) {
                    Text(isToday ? "Today" : vm.date.formatted(.dateTime.weekday(.wide)))
                        .font(Theme.heading(.title3))
                    DatePicker("Entry date", selection: $vm.date, in: ...Date(), displayedComponents: .date)
                        .labelsHidden().datePickerStyle(.compact)
                }
                Spacer()
                Button { shiftDay(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                    .disabled(isToday)
                    .accessibilityLabel("Next day")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.accent)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: dynamicTypeSize.isAccessibilitySize ? 1 : 3), spacing: 10) {
                summaryTile("Recovery", value: vm.recovery.map { "\(Int($0))%" }, icon: "heart.fill", color: Theme.recovery)
                summaryTile("Sleep", value: vm.sleepHours.map { h in
                    let m = Int((h * 60).rounded()); return "\(m / 60)h \(m % 60)m" }, icon: "bed.double.fill", color: Theme.sleep)
                summaryTile("Strain", value: vm.strain.map { String(format: "%.1f", $0) }, icon: "flame.fill", color: Theme.amber)
            }
        }
        .card()
    }

    private func summaryTile(_ title: String, value: String?, icon: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).foregroundStyle(color)
            Text(value ?? "—").font(Theme.heading(.headline))
                .fixedSize(horizontal: false, vertical: true)
            Text(title).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }

    private func sectionHeader(_ title: String, icon: String, color: Color) -> some View {
        Label {
            Text(title)
        } icon: {
            Image(systemName: icon).foregroundStyle(color)
        }
    }

    private var hydrationProgress: some View {
        let target = max(vm.waterTarget.targetMl, 1)
        let current = Int(vm.hydration ?? 0)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(current) of \(target) ml").font(Theme.body(.subheadline).weight(.medium))
                Spacer()
                Text("\(min(100, current * 100 / target))%").font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            }
            ProgressView(value: min(Double(current), Double(target)), total: Double(target))
                .tint(Theme.water)
        }
        .padding(.vertical, 4)
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
                    .buttonStyle(CoveButtonStyle()).controlSize(.regular)
                }
                Button("Hit target") {
                    Haptics.tap()
                    vm.hydration = Double(t.targetMl)
                }
                .buttonStyle(CoveButtonStyle(prominent: true)).controlSize(.regular)
                .disabled(current >= t.targetMl)
            }
        }
    }

    /// Sleep split into whole hours + remaining minutes for easier entry.
    private var sleepHrsBinding: Binding<Double?> {
        Binding(
            get: { vm.sleepHours.map { Double(Int($0)) } },
            set: { h in
                let mins = ((vm.sleepHours ?? 0).truncatingRemainder(dividingBy: 1) * 60).rounded() / 60
                vm.sleepHours = h.map { $0 + mins }
            }
        )
    }

    private var sleepMinBinding: Binding<Double?> {
        Binding(
            get: { vm.sleepHours.map { ($0.truncatingRemainder(dividingBy: 1) * 60).rounded() } },
            set: { m in
                let hrs = Double(Int(vm.sleepHours ?? 0))
                vm.sleepHours = m.map { hrs + $0 / 60 }
            }
        )
    }

    private func numberRow(_ label: String,
                           unit: String? = nil,
                           value: Binding<Double?>,
                           hint: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if !label.isEmpty {
                Text(label).font(Theme.body(.subheadline).weight(.medium))
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("—", value: value, format: .number)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(label)
                if let unit {
                    Text(unit).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                        .fixedSize()
                }
            }
            .numericInputSurface()
            if let hint {
                Text(hint).font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 4)
    }
}
