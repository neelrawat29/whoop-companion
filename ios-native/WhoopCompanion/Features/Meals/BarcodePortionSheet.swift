import SwiftUI

/// After a barcode lookup: ask how much was eaten instead of assuming one
/// serving (or 100 g when the product has no serving size).
struct BarcodePortionSheet: View {
    let product: BarcodeLookupResult
    var onAdd: (_ grams: Double) -> Void
    var onCancel: () -> Void

    @State private var gramsText: String
    @FocusState private var gramsFocused: Bool

    init(product: BarcodeLookupResult, onAdd: @escaping (Double) -> Void, onCancel: @escaping () -> Void) {
        self.product = product
        self.onAdd = onAdd
        self.onCancel = onCancel
        _gramsText = State(initialValue: product.servingG.map { Self.fmt($0) } ?? "")
    }

    private var grams: Double? {
        guard let g = Double(gramsText.replacingOccurrences(of: ",", with: ".")), g > 0, g <= 5000 else { return nil }
        return g
    }

    private var title: String {
        [product.brand, product.name].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " — ")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).font(Theme.body(.headline))
                        let per100 = product.macros(forGrams: 100)
                        Text("Per 100 g: \(Self.v(per100.kcal)) kcal · P \(Self.v(per100.protein))g · C \(Self.v(per100.carbs))g · F \(Self.v(per100.fat))g")
                            .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    }

                    if let serving = product.servingG, serving > 0 {
                        HStack(spacing: 8) {
                            ForEach([0.5, 1.0, 2.0], id: \.self) { n in
                                Button(n == 0.5 ? "½ serving" : n == 1 ? "1 serving" : "2 servings") {
                                    Haptics.selection()
                                    gramsText = Self.fmt(serving * n)
                                }
                                .buttonStyle(CoveButtonStyle(fill: true))
                            }
                        }
                        Text("1 serving = \(Self.fmt(serving)) g")
                            .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                    } else {
                        Label("No serving size on file for this product. Enter how much you had.",
                              systemImage: "info.circle")
                            .font(Theme.body(.caption)).foregroundStyle(Theme.amberText)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Amount").font(Theme.body(.footnote).weight(.semibold))
                        Text("Grams for food, ml for drinks.")
                            .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary)
                        HStack {
                            TextField("e.g. 30", text: $gramsText)
                                .keyboardType(.decimalPad)
                                .focused($gramsFocused)
                                .textFieldStyle(CoveInputStyle())
                            Text("g / ml").font(Theme.body(.subheadline)).foregroundStyle(Theme.textSecondary)
                        }
                    }

                    if let g = grams {
                        let m = product.macros(forGrams: g)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(Self.v(m.kcal)) kcal").font(Theme.body(.headline)).monospacedDigit()
                            Text("Protein \(Self.v(m.protein))g · Carbs \(Self.v(m.carbs))g · Fat \(Self.v(m.fat))g")
                                .font(Theme.body(.caption)).foregroundStyle(Theme.textSecondary).monospacedDigit()
                        }
                    }

                    Button {
                        if let g = grams { onAdd(g) }
                    } label: {
                        Text("Add").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(CoveButtonStyle(prominent: true, fill: true))
                    .disabled(grams == nil)
                }
                .padding()
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("How much did you have?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
            }
            .onAppear { if product.servingG == nil { gramsFocused = true } }
        }
    }

    static func fmt(_ g: Double) -> String {
        g.rounded() == g ? String(Int(g)) : String(format: "%.1f", g)
    }

    static func v(_ x: Double?) -> String {
        guard let x else { return "—" }
        return x.rounded() == x ? String(Int(x)) : String(format: "%.1f", x)
    }
}
