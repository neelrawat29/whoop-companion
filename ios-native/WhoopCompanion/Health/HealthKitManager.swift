import Foundation
import HealthKit

/// Reads recent HRV, RHR, sleep, weight, and water from Apple Health so the
/// End-of-day Recap can pre-fill the user's daily log without typing.
@MainActor
final class HealthKitManager {
    static let shared = HealthKitManager()
    private let store = HKHealthStore()

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private var readTypes: Set<HKObjectType> {
        var s: Set<HKObjectType> = []
        if let t = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { s.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { s.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass) { s.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .dietaryWater) { s.insert(t) }
        if let t = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { s.insert(t) }
        return s
    }

    func requestAuthorization() async -> Bool {
        guard isAvailable else { return false }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            return true
        } catch { return false }
    }

    struct DailySnapshot {
        var hrvMs: Double?
        var rhrBpm: Double?
        var sleepHours: Double?
        var weightKg: Double?
        var waterMl: Double?
    }

    /// Fetches values for the local calendar day containing `date`.
    func snapshot(for date: Date = Date()) async -> DailySnapshot {
        guard isAvailable else { return DailySnapshot() }
        let cal = Calendar.current
        let start = cal.startOfDay(for: date)
        let end = cal.date(byAdding: .day, value: 1, to: start) ?? date
        // Sleep window: the "night for this day" is [start - 12h, start + 12h]
        let sleepStart = cal.date(byAdding: .hour, value: -12, to: start) ?? start
        let sleepEnd = cal.date(byAdding: .hour, value: 12, to: start) ?? end

        async let hrv = latestQuantity(.heartRateVariabilitySDNN, unit: HKUnit(from: "ms"), from: cal.date(byAdding: .day, value: -1, to: start) ?? start, to: end)
        async let rhr = latestQuantity(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), from: cal.date(byAdding: .day, value: -1, to: start) ?? start, to: end)
        async let weight = latestQuantity(.bodyMass, unit: .gramUnit(with: .kilo), from: cal.date(byAdding: .day, value: -7, to: start) ?? start, to: end)
        async let water = sumQuantity(.dietaryWater, unit: .literUnit(with: .milli), from: start, to: end)
        async let sleep = sleepHours(from: sleepStart, to: sleepEnd)

        var snap = DailySnapshot()
        snap.hrvMs = await hrv
        snap.rhrBpm = await rhr
        snap.weightKg = await weight
        snap.waterMl = await water
        snap.sleepHours = await sleep
        return snap
    }

    private func latestQuantity(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date) async -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictEndDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                let v = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                cont.resume(returning: v)
            }
            store.execute(q)
        }
    }

    private func sumQuantity(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date) async -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        return await withCheckedContinuation { cont in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
                cont.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(q)
        }
    }

    private func sleepHours(from: Date, to: Date) async -> Double? {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictEndDate)
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
                    cont.resume(returning: nil); return
                }
                let asleepValues: Set<Int> = [
                    HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                    HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                    HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                ]
                let secs = samples
                    .filter { asleepValues.contains($0.value) }
                    .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                cont.resume(returning: secs > 0 ? secs / 3600.0 : nil)
            }
            store.execute(q)
        }
    }
}
