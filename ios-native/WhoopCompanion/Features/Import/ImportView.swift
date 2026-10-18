import SwiftUI
import UniformTypeIdentifiers

struct ImportView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("Bring in past WHOOP history from a CSV export. New days sync automatically once WHOOP is connected in Settings.")
                .font(.footnote).foregroundStyle(.secondary)
                .padding(.horizontal)
            CsvImportView()

            Spacer()
        }
        .scrollDismissesKeyboard(.interactively)
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
