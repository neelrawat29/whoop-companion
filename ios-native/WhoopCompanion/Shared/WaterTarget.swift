import Foundation

/// Personalised hydration target. Mirrors `computeWaterTarget` in
/// src/lib/targets.shared.ts — keep both formulas identical.
struct WaterTarget {
    let targetMl: Int
    let baselineMl: Int
    let strainBonusMl: Int

    static let quickAdds: [(ml: Int, label: String)] = [(250, "Glass"), (500, "Bottle"), (750, "Shaker")]

    static func compute(weightKg: Double?, sex: String?, strain: Double?) -> WaterTarget {
        let w = weightKg ?? 0
        let perKg: Double = sex == "male" ? 35 : 31
        let baseRaw = w > 30 ? w * perKg : 2500
        let base = Int((baseRaw / 50).rounded()) * 50
        let s = max(0, min(21, strain ?? 0))
        let bonus = Int((s * 60 / 50).rounded()) * 50
        let target = max(1500, min(6000, base + bonus))
        return WaterTarget(targetMl: target, baselineMl: base, strainBonusMl: bonus)
    }
}
