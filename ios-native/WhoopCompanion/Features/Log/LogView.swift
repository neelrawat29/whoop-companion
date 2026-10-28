import SwiftUI

struct LogView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var vm = LogViewModel()
    @State private var toast: ToastMessage?
    @State private var justSaved: Bool = false

    @State private var showManual = false
    @State private var autosaveTask: Task<Void, Never>?
    @State private var loaded = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let s = vm.status, s.hasPrefix("Load failed") {
                    ErrorBanner(message: "Couldn't load this day's log. " + friendlyError(String(s.dropFirst("Load failed: ".count)))) {
                        Task { await vm.load() }
                    }
                }
                header
                wearableCard
                waterCard
                habitsCard
                journalCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
        .background(Theme.background.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .toast($toast)
        .navigationTitle("Daily Log")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.load(); loaded = true }
        .refreshable {
            struct B: Encodable { let action = "sync" }
            struct R: Decodable { let days: Int }
            _ = try? await APIClient.shared.callAPI(path: "whoop", body: B(), as: R.self)
            await vm.load()
        }
        .onChange(of: vm.date) { _, _ in
            loaded = false
            Task { await vm.load(); loaded = true }
        }
        .onChange(of: vm.hydration) { _, _ in scheduleSave() }
        .onChange(of: vm.drinks) { _, _ in scheduleSave() }
        .onChange(of: vm.workLocation) { _, _ in scheduleSave() }
        .onChange(of: vm.note) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.recovery) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.hrv) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.rhr) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.sleepHours) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.sleepScore) { _, _ in scheduleSave(delay: 1.2) }
        .onChange(of: vm.strain) { _, _ in scheduleSave(delay: 1.2) }
    }

    // MARK: Auto-save

    private func scheduleSave(delay: Double = 0.6) {
        guard loaded else { return }
        autosaveTask?.cancel()
        autosaveTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await handleSave()
        }
    }

    private func handleSave() async {
        await vm.save()
        if let status = vm.status, status.hasPrefix("Saved") {
            Haptics.success()
            withAnimation { justSaved = true }
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            withAnimation { justSaved = false }
        } else if let status = vm.status {
            Haptics.error()
            toast = ToastMessage(kind: .error, text: status)
        }
    }

    // MARK: Header

    private var isToday: Bool { Calendar.current.isDateInToday(vm.date) }

    private func shiftDay(_ by: Int) {
        guard let d = Calendar.current.date(byAdding: .day, value: by, to: vm.date), d <= Date() else { return }
        Haptics.selection()
        vm.date = d
    }

    private var header: some View {
        VStack(spacing: 10) {
            HStack {
                Button { shiftDay(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .accessibilityLabel("Previous day")
                Spacer()
                VStack(spacing: 2) {
                    Text(isToday ? "Today" : vm.date.formatted(.dateTime.weekday(.wide)))
                        .font(Theme.heading(.title2))
                        .foregroundStyle(Theme.textPrimary)
                    DatePicker("Entry date", selection: $vm.date, in: ...Date(), displayedComponents: .date)
                        .labelsHidden().datePickerStyle(.compact)
                }
                Spacer()
                Button { shiftDay(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                    .disabled(isToday)
                    .opacity(isToday ? 0.3 : 1)
                    .accessibilityLabel("Next day")
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.accent)

            statusPill
        }
    }

    private var statusPill: some View {
        let synced = vm.recovery != nil || vm.sleepHours != nil || vm.strain != nil
        let (text, color): (String, Color) = {
            if vm.isSaving { return ("Saving…", Theme.textSecondary) }
            if justSaved { return ("Saved", Theme.recovery) }
            return synced ? ("Synced with WHOOP", Theme.recovery) : ("No WHOOP data yet", Theme.textSecondary)
        }()
        return HStack(spacing: 6) {
            Image(systemName: justSaved ? "checkmark" : "circle.fill")
                .font(.system(size: justSaved ? 10 : 7, weight: .bold))
            Text(text).font(Theme.body(.caption).weight(.semibold))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(color.opacity(0.12), in: Capsule())
        .animation(.easeInOut(duration: 0.2), value: text)
    }

    // MARK: Cards

    private func cardTitle(_ title: String, icon: String, color: Color, trailing: String? = nil) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 34, height: 34)
                .background(color.opacity(0.14), in: Circle())
                .accessibilityHidden(true)
            Text(title).font(Theme.body(.headline)).foregroundStyle(Theme.textPrimary)
            Spacer()
            if let trailing {
                Text(trailing).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private var wearableCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            cardTitle("From your wearable", icon: "waveform.path.ecg", color: Theme.recovery)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: dynamicTypeSize.isAccessibilitySize ? 1 : 3), spacing: 10) {
                summaryTile("Recovery", value: vm.recovery.map { "\(Int($0))%" }, icon: "heart", color: Theme.recovery)
                summaryTile("Sleep", value: vm.sleepHours.map { h in
                    let m = Int((h * 60).rounded()); return "\(m / 60)h \(m % 60)m" }, icon: "moon", color: Theme.sleep)
                summaryTile("Strain", value: vm.strain.map { String(format: "%.1f", $0) }, icon: "flame", color: Theme.amber)
            }
            if vm.hasBedtime || vm.hasWakeTime {
                HStack {
                    Label(vm.hasBedtime ? vm.bedtime.formatted(date: .omitted, time: .shortened) : "—", systemImage: "moon.zzz")
                    Spacer()
                    Label(vm.hasWakeTime ? vm.wakeTime.formatted(date: .omitted, time: .shortened) : "—", systemImage: "sunrise")
                }
                .font(Theme.body(.footnote))
                .foregroundStyle(Theme.textSecondary)
                .labelStyle(TintedIconLabel(color: Theme.sleep))
            }
            Button {
                Haptics.selection()
                withAnimation(.easeInOut(duration: 0.25)) { showManual.toggle() }
            } label: {
                HStack {
                    Text(showManual ? "Hide manual entries" : "Edit manual entries")
                    Spacer()
                    Image(systemName: "chevron.down").rotationEffect(.degrees(showManual ? 180 : 0))
                }
                .font(Theme.body(.subheadline).weight(.medium))
                .foregroundStyle(Theme.accent)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showManual {
                VStack(spacing: 10) {
                    grid2 {
                        numberRow("Recovery", unit: "%", value: $vm.recovery)
                        numberRow("Strain", unit: "0–21", value: $vm.strain)
                        numberRow("HRV", unit: "ms", value: $vm.hrv)
                        numberRow("Resting HR", unit: "bpm", value: $vm.rhr)
                        numberRow("Sleep", unit: "hr", value: sleepHrsBinding)
                        numberRow("", unit: "min", value: sleepMinBinding, topLabel: "Minutes")
                    }
                    numberRow("Sleep score", unit: "/100", value: $vm.sleepScore)
                    Text("Use these only if you didn't wear your WHOOP. Synced values fill in automatically.")
                        .font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .card()
    }

    @ViewBuilder
    private func grid2<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: dynamicTypeSize.isAccessibilitySize ? 1 : 2), alignment: .leading, spacing: 10) {
            content()
        }
    }

    private var waterCard: some View {
        let target = max(vm.waterTarget.targetMl, 1)
        let current = Int(vm.hydration ?? 0)
        let pct = min(1, Double(current) / Double(target))
        let remaining = max(0, target - current)
        return VStack(alignment: .leading, spacing: 14) {
            cardTitle("Water", icon: "drop", color: Theme.water, trailing: "\(Int(pct * 100))%")
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(current.formatted()).font(Theme.heading(.largeTitle)).foregroundStyle(Theme.textPrimary)
                    .contentTransition(.numericText())
                Text("of \(target.formatted()) ml").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.water.opacity(0.14))
                    Capsule().fill(Theme.water).frame(width: max(10, g.size.width * pct))
                }
            }
            .frame(height: 10)
            .animation(.spring(response: 0.45, dampingFraction: 0.8), value: pct)
            Text(remaining > 0 ? "\(remaining.formatted()) ml to go · \(waterHint)" : "Target reached — nice work.")
                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(WaterTarget.quickAdds, id: \.ml) { q in
                        chip("+\(q.ml) ml", color: Theme.water) {
                            withAnimation { vm.hydration = Double(current + q.ml) }
                        }
                    }
                    chip("Hit target", color: Theme.water, filled: true) {
                        withAnimation { vm.hydration = Double(target) }
                    }
                    .disabled(current >= target)
                    .opacity(current >= target ? 0.4 : 1)
                    if current > 0 {
                        chip("Undo", color: Theme.textSecondary, icon: "arrow.uturn.backward") {
                            let last = WaterTarget.quickAdds.first?.ml ?? 250
                            withAnimation { vm.hydration = Double(max(0, current - last)) }
                        }
                    }
                }
            }
        }
        .card()
    }

    private func chip(_ title: String, color: Color, filled: Bool = false, icon: String? = nil, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon).font(.system(size: 12, weight: .semibold)) }
                Text(title).font(Theme.body(.subheadline).weight(.semibold))
            }
            .padding(.horizontal, 14).frame(minHeight: 40)
            .foregroundStyle(filled ? Color.white : color)
            .background(filled ? color : color.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var habitsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            cardTitle("Habits", icon: "leaf", color: Theme.protein)

            // Drinks counter
            HStack(spacing: 12) {
                Image(systemName: "wineglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 40, height: 40)
                    .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Alcohol").font(Theme.body(.subheadline).weight(.semibold)).foregroundStyle(Theme.textPrimary)
                    Text(drinksLabel).font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                counterButton("minus", disabled: vm.drinks == 0) { vm.drinks = max(0, vm.drinks - 1) }
                    .accessibilityLabel("One fewer drink")
                Text("\(vm.drinks)")
                    .font(Theme.heading(.title3)).monospacedDigit()
                    .frame(minWidth: 28)
                    .contentTransition(.numericText())
                counterButton("plus", disabled: vm.drinks >= 20) { vm.drinks = min(20, vm.drinks + 1) }
                    .accessibilityLabel("One more drink")
            }

            Divider().overlay(Theme.cardBorder)

            VStack(alignment: .leading, spacing: 10) {
                Text("Where did you work?").font(Theme.body(.subheadline).weight(.semibold)).foregroundStyle(Theme.textPrimary)
                HStack(spacing: 8) {
                    workPill("Home", value: "home", icon: "house", color: Theme.amber)
                    workPill("Office", value: "office", icon: "building.2", color: Theme.sleep)
                    workPill("Off", value: "off", icon: "sun.max", color: Theme.recovery)
                }
            }
        }
        .card()
    }

    private var drinksLabel: String {
        switch vm.drinks {
        case 0: return "None today"
        case 1...2: return "Moderate"
        default: return "Heavy — may lower recovery"
        }
    }

    private func counterButton(_ icon: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            withAnimation { action() }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.accent)
                .frame(width: 40, height: 40)
                .background(Theme.accent.opacity(0.12), in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.35 : 1)
    }

    private func workPill(_ title: String, value: String, icon: String, color: Color) -> some View {
        let selected = vm.workLocation == value
        return Button {
            Haptics.selection()
            withAnimation(.easeInOut(duration: 0.15)) { vm.workLocation = selected ? "" : value }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 36, height: 36)
                    .background(color.opacity(selected ? 0.22 : 0.12), in: Circle())
                Text(title).font(Theme.body(.footnote).weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 10)
            .background(selected ? color.opacity(0.1) : Theme.background, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? color : Theme.cardBorder, lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var journalCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            cardTitle("Journal", icon: "pencil.line", color: Theme.amber)
            TextField("How did you feel today? Any travel, stress or late meals?", text: $vm.note, axis: .vertical)
                .font(Theme.body(.body))
                .lineLimit(3...8)
                .padding(14)
                .background(Theme.background, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardBorder, lineWidth: 1))
            Text("Saves automatically. Notes help spot patterns in Insights.")
                .font(Theme.body(.caption2)).foregroundStyle(Theme.textSecondary)
        }
        .card()
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

    private var waterHint: String {
        let t = vm.waterTarget
        var s = String(format: "target %.1f L", Double(t.targetMl) / 1000)
        if t.strainBonusMl > 0 { s += " (+\(t.strainBonusMl) ml for strain)" }
        return s
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
                           hint: String? = nil,
                           topLabel: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let t = topLabel ?? (label.isEmpty ? nil : label) {
                Text(t).font(Theme.body(.subheadline).weight(.medium))
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("—", value: value, format: .number)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(topLabel ?? label)
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


private struct TintedIconLabel: LabelStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon.foregroundStyle(color)
            configuration.title
        }
    }
}
