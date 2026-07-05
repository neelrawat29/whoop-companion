import SwiftUI
import UniformTypeIdentifiers
import PhotosUI

struct ImportView: View {
    @State private var tab: Tab = .csv
    enum Tab: String, CaseIterable, Identifiable { case csv = "CSV upload", screenshot = "Screenshot AI"; var id: Self { self } }

    var body: some View {
        VStack(spacing: 12) {
            Picker("Mode", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            switch tab {
            case .csv: CsvImportView()
            case .screenshot: ScreenshotImportView()
            }

            Spacer()
        }
        .navigationTitle("Import")
    }
}

// MARK: - CSV

private struct CsvImportView: View {
    @State private var showingPicker = false
    @State private var busy = false
    @State private var status: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Upload physiological_cycles.csv from the Whoop app's Data Export.")
                    .font(.footnote).foregroundStyle(.secondary)
                Button {
                    showingPicker = true
                } label: {
                    Label("Choose CSV file", systemImage: "doc.badge.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy)

                if busy { ProgressView("Importing…") }
                if let s = status { Text(s).font(.footnote).foregroundStyle(s.hasPrefix("Imported") ? .green : .red) }
            }
            .padding()
            .card()
            .padding()
        }
        .fileImporter(isPresented: $showingPicker,
                      allowedContentTypes: [.commaSeparatedText, .plainText],
                      allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first { Task { await handle(url: url) } }
            case .failure(let e):
                status = e.localizedDescription
            }
        }
    }

    private func handle(url: URL) async {
        busy = true; defer { busy = false }
        do {
            let secured = url.startAccessingSecurityScopedResource()
            defer { if secured { url.stopAccessingSecurityScopedResource() } }
            let text = try String(contentsOf: url, encoding: .utf8)
            let rows = parseWhoopCsv(text)
            guard !rows.isEmpty else { status = "No valid rows"; return }
            guard let userId = try? await SupabaseManager.shared.client.auth.session.user.id else {
                status = "Not signed in"; return
            }
            struct Row: Encodable {
                let user_id: UUID; let entry_date: String
                let recovery: Double?; let hrv: Double?; let rhr: Double?
                let sleep_score: Double?; let sleep_hours: Double?
                let source: String
            }
            let payload = rows.map { Row(
                user_id: userId, entry_date: $0.date,
                recovery: $0.recovery, hrv: $0.hrv, rhr: $0.rhr,
                sleep_score: $0.sleepScore, sleep_hours: $0.sleepHours,
                source: "csv"
            )}
            try await SupabaseManager.shared.client.from("daily_entries")
                .upsert(payload, onConflict: "user_id,entry_date").execute()
            status = "Imported \(payload.count) days ✓"
        } catch {
            status = "Import failed: \(error.localizedDescription)"
        }
    }
}

struct CsvRow { let date: String; let recovery: Double?; let hrv: Double?; let rhr: Double?; let sleepScore: Double?; let sleepHours: Double? }

func parseWhoopCsv(_ text: String) -> [CsvRow] {
    let lines = text.split(whereSeparator: \.isNewline).map(String.init)
    guard lines.count >= 2 else { return [] }
    let header = splitCsv(lines[0]).map { $0.lowercased() }
    func idx(_ needles: [String]) -> Int? {
        for n in needles {
            if let i = header.firstIndex(where: { $0.contains(n) }) { return i }
        }
        return nil
    }
    let iDate = idx(["cycle start time", "date"])
    let iRec = idx(["recovery score"])
    let iHrv = idx(["heart rate variability", "hrv"])
    let iRhr = idx(["resting heart rate", "rhr"])
    let iSS = idx(["sleep performance"])
    let iSH = idx(["asleep duration", "sleep duration"])

    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let iso2 = ISO8601DateFormatter()

    var out: [CsvRow] = []
    var seen = Set<String>()
    for i in 1..<lines.count {
        let cols = splitCsv(lines[i])
        guard let di = iDate, di < cols.count else { continue }
        let raw = cols[di]
        let d: Date? = iso.date(from: raw) ?? iso2.date(from: raw) ?? DateFormatter.entryDate.date(from: raw)
        guard let date = d else { continue }
        let ds = date.entryDateString
        if seen.contains(ds) { continue }
        seen.insert(ds)
        func v(_ i: Int?) -> Double? { guard let i, i < cols.count else { return nil }; return Double(cols[i]) }
        out.append(CsvRow(date: ds, recovery: v(iRec), hrv: v(iHrv), rhr: v(iRhr), sleepScore: v(iSS), sleepHours: v(iSH)))
    }
    return out
}

private func splitCsv(_ line: String) -> [String] {
    var out: [String] = []; var cur = ""; var inQ = false
    for c in line {
        if c == "\"" { inQ.toggle(); continue }
        if c == "," && !inQ { out.append(cur); cur = ""; continue }
        cur.append(c)
    }
    out.append(cur); return out
}

// MARK: - Screenshot AI

private struct ScreenshotImportView: View {
    @State private var pickerItem: PhotosPickerItem?
    @State private var imageData: Data?
    @State private var busy = false
    @State private var status: String?
    @State private var result: ExtractResult?
    @State private var date = Date()

    struct ExtractResult: Codable {
        var recovery: Double?
        var hrv: Double?
        var rhr: Double?
        var sleep_score: Double?
        var sleep_hours: Double?
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("AI extracts your Recovery, HRV, RHR, and Sleep from a Whoop screenshot.")
                    .font(.footnote).foregroundStyle(.secondary)

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label("Choose screenshot", systemImage: "photo").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy)

                if let data = imageData, let ui = UIImage(data: data) {
                    Image(uiImage: ui).resizable().scaledToFit()
                        .frame(maxHeight: 220).cornerRadius(8)
                }
                if busy { ProgressView("Extracting…") }

                if let r = result {
                    DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                    Grid(alignment: .leading) {
                        editable("Recovery", value: r.recovery) { result?.recovery = $0 }
                        editable("HRV", value: r.hrv) { result?.hrv = $0 }
                        editable("RHR", value: r.rhr) { result?.rhr = $0 }
                        editable("Sleep score", value: r.sleep_score) { result?.sleep_score = $0 }
                        editable("Sleep hrs", value: r.sleep_hours) { result?.sleep_hours = $0 }
                    }
                    Button("Save") { Task { await save() } }
                        .buttonStyle(.borderedProminent).disabled(busy)
                }

                if let s = status { Text(s).font(.footnote).foregroundStyle(s.hasPrefix("Saved") ? .green : .red) }
            }
            .padding().card().padding()
        }
        .onChange(of: pickerItem) { _, newItem in
            guard let newItem else { return }
            Task { await load(item: newItem) }
        }
    }

    private func editable(_ label: String, value: Double?, set: @escaping (Double?) -> Void) -> some View {
        GridRow {
            Text(label).font(.caption).foregroundStyle(.secondary)
            TextField("—", text: Binding(
                get: { value.map { String($0) } ?? "" },
                set: { set(Double($0)) }
            ))
            .keyboardType(.decimalPad)
            .textFieldStyle(.roundedBorder)
        }
    }

    private func load(item: PhotosPickerItem) async {
        do {
            let data = try await item.loadTransferable(type: Data.self)
            imageData = data
            result = nil
            if let data { await runExtract(data: data) }
        } catch {
            status = error.localizedDescription
        }
    }

    private func runExtract(data: Data) async {
        busy = true; defer { busy = false }
        struct Body: Encodable { let data: Payload; struct Payload: Encodable { let imageBase64: String } }
        let b64 = "data:image/png;base64,\(data.base64EncodedString())"
        do {
            let r: ExtractResult = try await APIClient.shared.callServerFn(
                name: "extractFromScreenshot", body: Body(data: .init(imageBase64: b64))
            )
            result = r
        } catch {
            status = "Extraction failed: \(error.localizedDescription)"
        }
    }

    private func save() async {
        guard let r = result else { return }
        guard let userId = try? await SupabaseManager.shared.client.auth.session.user.id else { return }
        busy = true; defer { busy = false }
        struct Row: Encodable {
            let user_id: UUID; let entry_date: String
            let recovery: Double?; let hrv: Double?; let rhr: Double?
            let sleep_score: Double?; let sleep_hours: Double?
            let source: String
        }
        do {
            try await SupabaseManager.shared.client.from("daily_entries").upsert(Row(
                user_id: userId, entry_date: date.entryDateString,
                recovery: r.recovery, hrv: r.hrv, rhr: r.rhr,
                sleep_score: r.sleep_score, sleep_hours: r.sleep_hours,
                source: "screenshot"
            ), onConflict: "user_id,entry_date").execute()
            status = "Saved ✓"
            result = nil; imageData = nil; pickerItem = nil
        } catch {
            status = "Save failed: \(error.localizedDescription)"
        }
    }
}
