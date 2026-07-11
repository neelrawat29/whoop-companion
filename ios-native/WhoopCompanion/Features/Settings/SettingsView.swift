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

    var weightGoalKg: String = ""
    var hasWeightGoalDate: Bool = false
    var weightGoalDate: Date = Date()
    var weightUnit: String = "kg"  // "kg" | "lb"

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
            weightGoalKg = p.weightGoalKg.map { String($0) } ?? ""
            weightUnit = p.weightUnit
            if let dob = p.dateOfBirth, let d = DateFormatter.entryDate.date(from: dob) {
                dateOfBirth = d; hasDob = true
            }
            if let g = p.weightGoalDate, let d = DateFormatter.entryDate.date(from: g) {
                weightGoalDate = d; hasWeightGoalDate = true
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
            let weight_goal_kg: Double?
            let weight_goal_date: String?
            let weight_unit: String
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
                resting_hr_baseline: Double(rhrBaseline),
                weight_goal_kg: Double(weightGoalKg),
                weight_goal_date: hasWeightGoalDate ? weightGoalDate.entryDateString : nil,
                weight_unit: weightUnit
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
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Display name").font(.subheadline)
                        Spacer()
                        TextField("Your name", text: $vm.displayName)
                            .multilineTextAlignment(.trailing)
                    }
                    Text("Shown to other members of your groups.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            } header: {
                Text("Profile")
            }

            Section {
                thresholdRow("Push if recovery ≥", unit: "%", text: $vm.thresholdPush)
                thresholdRow("Rest if recovery <", unit: "%", text: $vm.thresholdRest)
            } header: {
                Text("Recovery thresholds")
            } footer: {
                Text("Used to categorize your day as Push, Maintain, or Rest.")
            }

            Section {
                Toggle("Set date of birth", isOn: $vm.hasDob)
                if vm.hasDob {
                    DatePicker("Date of birth", selection: $vm.dateOfBirth,
                               in: ...Date(), displayedComponents: .date)
                }
                Picker("Sex", selection: $vm.sex) {
                    Text("Not set").tag("")
                    Text("Male").tag("male")
                    Text("Female").tag("female")
                    Text("Other").tag("other")
                }
                LabeledNumber("Height", unit: "cm", text: $vm.heightCm)
                LabeledNumber("Current weight", unit: "kg", text: $vm.weightKg)
                LabeledNumber("Resting HR baseline", unit: "bpm", text: $vm.rhrBaseline)
            } header: {
                Text("Body & baseline")
            } footer: {
                Text("Optional — required to unlock your Biological Age score.")
            }

            Section {
                LabeledNumber("Weight goal", unit: "kg", text: $vm.weightGoalKg)
                Toggle("Set target date", isOn: $vm.hasWeightGoalDate)
                if vm.hasWeightGoalDate {
                    DatePicker("Target date", selection: $vm.weightGoalDate,
                               in: Date()..., displayedComponents: .date)
                }
                Picker("Preferred unit", selection: $vm.weightUnit) {
                    Text("Kilograms (kg)").tag("kg")
                    Text("Pounds (lb)").tag("lb")
                }
            } header: {
                Text("Weight goal")
            } footer: {
                Text("Optional — shows a goal ring on the Weight page.")
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
                if !session.email.isEmpty {
                    HStack {
                        Text("Signed in as").foregroundStyle(.secondary).font(.footnote)
                        Spacer()
                        Text(session.email).font(.footnote)
                    }
                }
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            }

            Section {
                Button("Erase all data", role: .destructive) {
                    showEraseConfirm = true
                }
                Button("Delete account", role: .destructive) {
                    showDeleteConfirm = true
                }
                if let s = dangerStatus {
                    Text(s).font(.footnote).foregroundStyle(.red)
                }
            } header: {
                Text("Danger zone")
            } footer: {
                Text("Erasing removes all your logs, meals, weights, supplements, chats and insights but keeps your account. Deleting removes everything including your account.")
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .keyboardDoneToolbar()
        .navigationTitle("Settings")

        .task { await vm.load() }
        .alert("Erase all your data?", isPresented: $showEraseConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Erase everything", role: .destructive) {
                Task { await eraseData() }
            }
        } message: {
            Text("This permanently deletes all your logs, meals, weights, supplements, chats and insights, and resets your baseline & targets. This cannot be undone.")
        }
        .alert("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete account", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("This permanently deletes your account and all associated data. This cannot be undone.")
        }
    }

    @State private var showEraseConfirm = false
    @State private var showDeleteConfirm = false
    @State private var dangerStatus: String?

    private struct EmptyBody: Encodable {}
    private struct OKResponse: Decodable { let ok: Bool }

    private func eraseData() async {
        dangerStatus = nil
        do {
            _ = try await APIClient.shared.callAPI(path: "erase-data", body: EmptyBody(), as: OKResponse.self)
            await vm.load()
            dangerStatus = "All data erased ✓"
        } catch {
            dangerStatus = "Erase failed: \(error.localizedDescription)"
        }
    }

    private func deleteAccount() async {
        dangerStatus = nil
        do {
            _ = try await APIClient.shared.callAPI(path: "delete-account", body: EmptyBody(), as: OKResponse.self)
            await session.signOut()
        } catch {
            dangerStatus = "Delete failed: \(error.localizedDescription)"
        }
    }

    @ViewBuilder
    private func thresholdRow(_ label: String, unit: String, text: Binding<String>) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            TextField("—", text: text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 60)
            Text(unit).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct LabeledNumber: View {
    let label: String
    let unit: String?
    @Binding var text: String
    init(_ label: String, unit: String? = nil, text: Binding<String>) {
        self.label = label; self.unit = unit; self._text = text
    }
    var body: some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            TextField("—", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 90)
            if let unit {
                Text(unit).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}
