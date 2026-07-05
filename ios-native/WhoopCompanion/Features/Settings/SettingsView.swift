import SwiftUI

@Observable
final class SettingsViewModel {
    var displayName: String = ""
    var thresholdPush: String = "67"
    var thresholdRest: String = "34"

    var dateOfBirth: Date = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    var hasDob = false
    var sex: String = ""
    var heightCm: String = ""
    var weightKg: String = ""
    var rhrBaseline: String = ""

    var isLoading = false
    var isSaving = false
    var status: String?

    private let client = SupabaseManager.shared.client

    func load() async {
        isLoading = true; defer { isLoading = false }
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            let rows: [Profile] = try await client.from("profiles")
                .select().eq("id", value: userId).limit(1).execute().value
            guard let p = rows.first else { return }
            displayName = p.displayName ?? ""
            thresholdPush = String(Int(p.thresholdPush))
            thresholdRest = String(Int(p.thresholdRest))
            sex = p.sex ?? ""
            heightCm = p.heightCm.map { String(Int($0)) } ?? ""
            weightKg = p.weightKg.map { String($0) } ?? ""
            rhrBaseline = p.restingHrBaseline.map { String(Int($0)) } ?? ""
            if let dob = p.dateOfBirth,
               let d = DateFormatter.entryDate.date(from: dob) {
                dateOfBirth = d
                hasDob = true
            }
        } catch { status = error.localizedDescription }
    }

    func save() async {
        isSaving = true; defer { isSaving = false }
        guard let userId = try? await client.auth.session.user.id else { return }
        struct Update: Encodable {
            let display_name: String?
            let threshold_push: Int
            let threshold_rest: Int
            let date_of_birth: String?
            let sex: String?
            let height_cm: Double?
            let weight_kg: Double?
            let resting_hr_baseline: Double?
        }
        do {
            try await client.from("profiles").update(Update(
                display_name: displayName.isEmpty ? nil : displayName,
                threshold_push: Int(thresholdPush) ?? 67,
                threshold_rest: Int(thresholdRest) ?? 34,
                date_of_birth: hasDob ? dateOfBirth.entryDateString : nil,
                sex: sex.isEmpty ? nil : sex,
                height_cm: Double(heightCm),
                weight_kg: Double(weightKg),
                resting_hr_baseline: Double(rhrBaseline)
            )).eq("id", value: userId).execute()
            status = "Saved ✓"
        } catch {
            status = "Save failed: \(error.localizedDescription)"
        }
    }
}

struct SettingsView: View {
    @State private var vm = SettingsViewModel()
    @Environment(SessionStore.self) private var session

    var body: some View {
        Form {
            Section("Profile & thresholds") {
                TextField("Display name", text: $vm.displayName)
                HStack {
                    Text("Push if recovery ≥")
                    Spacer()
                    TextField("67", text: $vm.thresholdPush)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing).frame(width: 60)
                }
                HStack {
                    Text("Rest if recovery <")
                    Spacer()
                    TextField("34", text: $vm.thresholdRest)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing).frame(width: 60)
                }
            }

            Section {
                Toggle("Set date of birth", isOn: $vm.hasDob)
                if vm.hasDob {
                    DatePicker("Date of birth", selection: $vm.dateOfBirth,
                               in: ...Date(), displayedComponents: .date)
                }
                Picker("Sex", selection: $vm.sex) {
                    Text("—").tag("")
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                    Text("Other").tag("other")
                }
                LabeledNumber("Height (cm)", text: $vm.heightCm)
                LabeledNumber("Weight (kg)", text: $vm.weightKg)
                LabeledNumber("Resting HR baseline", text: $vm.rhrBaseline)
            } header: {
                Text("Body & baseline")
            } footer: {
                Text("Unlocks your Biological Age score.")
            }

            Section {
                Button {
                    Task { await vm.save() }
                } label: {
                    if vm.isSaving { ProgressView() }
                    else { Text("Save changes").frame(maxWidth: .infinity) }
                }
                .disabled(vm.isSaving)
                if let s = vm.status {
                    Text(s).font(.footnote).foregroundStyle(s.hasPrefix("Saved") ? .green : .red)
                }
            }

            Section("Account") {
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            }
        }
        .navigationTitle("Settings")
        .task { await vm.load() }
    }
}

private struct LabeledNumber: View {
    let label: String
    @Binding var text: String
    init(_ label: String, text: Binding<String>) { self.label = label; self._text = text }
    var body: some View {
        HStack {
            Text(label)
            Spacer()
            TextField("—", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing).frame(width: 90)
        }
    }
}
