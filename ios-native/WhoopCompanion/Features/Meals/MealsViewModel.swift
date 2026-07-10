import Foundation
import Observation
import UIKit

@Observable
final class MealsViewModel {
    var date: Date = Date()
    var meals: [Meal] = []
    var presets: [MealPreset] = []
    var recents: [RecentMeal] = []
    var errorMessage: String?
    private let client = SupabaseManager.shared.client

    var totalKcal: Double { meals.reduce(0) { $0 + ($1.kcal ?? 0) } }
    var totalProtein: Double { meals.reduce(0) { $0 + ($1.proteinG ?? 0) } }
    var totalCarbs: Double { meals.reduce(0) { $0 + ($1.carbsG ?? 0) } }
    var totalFat: Double { meals.reduce(0) { $0 + ($1.fatG ?? 0) } }

    func load() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        do {
            meals = try await client.from("meals")
                .select()
                .eq("user_id", value: userId)
                .eq("entry_date", value: date.entryDateString)
                .order("created_at").execute().value
        } catch { errorMessage = error.localizedDescription }
        await loadPresets()
        await loadRecents()
    }

    func loadPresets() async {
        do { presets = try await APIClient.shared.getAPI(path: "meal-presets") }
        catch { /* non-fatal */ }
    }

    func loadRecents() async {
        do { recents = try await APIClient.shared.getAPI(path: "recent-meals") }
        catch { /* non-fatal */ }
    }

    func meal(for slot: String) -> Meal? { meals.first { $0.slot == slot } }
    func snacks() -> [Meal] { meals.filter { $0.slot == "snack" } }

    @discardableResult
    func save(id: UUID?, slot: String, description: String,
              kcal: Double?, protein: Double?, carbs: Double?, fat: Double?,
              source: String) async -> Bool {
        guard let userId = try? await client.auth.session.user.id else { return false }
        do {
            if let id {
                struct Update: Encodable {
                    let description: String
                    let kcal: Double?; let protein_g: Double?
                    let carbs_g: Double?; let fat_g: Double?
                    let source: String
                }
                try await client.from("meals")
                    .update(Update(description: description, kcal: kcal,
                                   protein_g: protein, carbs_g: carbs, fat_g: fat,
                                   source: source))
                    .eq("id", value: id).execute()
            } else {
                struct Insert: Encodable {
                    let user_id: UUID
                    let entry_date: String
                    let slot: String
                    let description: String
                    let kcal: Double?; let protein_g: Double?
                    let carbs_g: Double?; let fat_g: Double?
                    let source: String
                }
                try await client.from("meals").insert(Insert(
                    user_id: userId,
                    entry_date: date.entryDateString,
                    slot: slot,
                    description: description,
                    kcal: kcal, protein_g: protein, carbs_g: carbs, fat_g: fat,
                    source: source
                )).execute()
            }
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func addEmptySnack() async {
        _ = await save(id: nil, slot: "snack", description: "",
                       kcal: nil, protein: nil, carbs: nil, fat: nil, source: "manual")
    }

    func delete(id: UUID) async {
        _ = try? await client.from("meals").delete().eq("id", value: id).execute()
        await load()
    }

    // MARK: - Presets

    struct SavePresetBody: Encodable {
        let name: String
        let description: String
        let kcal: Double?
        let protein_g: Double?
        let carbs_g: Double?
        let fat_g: Double?
    }

    @discardableResult
    func savePreset(name: String, description: String,
                    kcal: Double?, protein: Double?, carbs: Double?, fat: Double?) async -> Bool {
        do {
            let body = SavePresetBody(name: name, description: description,
                                      kcal: kcal, protein_g: protein,
                                      carbs_g: carbs, fat_g: fat)
            let _: MealPreset = try await APIClient.shared.callAPI(path: "meal-presets", body: body)
            await loadPresets()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func deletePreset(id: UUID) async {
        struct Body: Encodable { let id: String }
        struct Ok: Decodable { let ok: Bool? }
        do {
            let _: Ok = try await APIClient.shared.deleteAPI(path: "meal-presets",
                                                             body: Body(id: id.uuidString))
            await loadPresets()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - AI Estimate (text)

struct MealEstimate: Decodable {
    let kcal: Double?
    let protein_g: Double?
    let carbs_g: Double?
    let fat_g: Double?
    let confidence: Double?
    let assumptions: String?
    let description: String?
}

enum MealEstimator {
    struct RequestBody: Encodable {
        let description: String
        let portionNotes: String
        let userKcalHint: Int?
    }

    static func estimate(description: String, portionNotes: String, userKcalHint: Int?) async throws -> MealEstimate {
        let body = RequestBody(
            description: description,
            portionNotes: portionNotes,
            userKcalHint: userKcalHint
        )
        return try await APIClient.shared.callAPI(path: "estimate-meal", body: body)
    }

    struct PhotoBody: Encodable {
        let imageBase64: String
        let portionNotes: String
        let userKcalHint: Int?
    }

    static func estimateFromPhoto(image: UIImage, portionNotes: String, userKcalHint: Int?) async throws -> MealEstimate {
        // Down-scale so we stay well under the 8 MB payload cap.
        let scaled = image.resizedForUpload(maxEdge: 1280)
        guard let jpeg = scaled.jpegData(compressionQuality: 0.7) else {
            throw APIError.badResponse(-1, "Could not encode photo")
        }
        let base64 = jpeg.base64EncodedString()
        let dataUrl = "data:image/jpeg;base64,\(base64)"
        let body = PhotoBody(imageBase64: dataUrl, portionNotes: portionNotes, userKcalHint: userKcalHint)
        return try await APIClient.shared.callAPI(path: "estimate-meal-photo", body: body)
    }
}

// MARK: - Barcode

enum BarcodeAPI {
    struct Body: Encodable { let barcode: String }
    static func lookup(_ code: String) async throws -> BarcodeLookupResult? {
        do {
            return try await APIClient.shared.callAPI(path: "lookup-barcode",
                                                      body: Body(barcode: code),
                                                      as: BarcodeLookupResult?.self)
        } catch APIError.decoding {
            // Server returned `null` (unknown barcode)
            return nil
        }
    }
}

// MARK: - Image helper

extension UIImage {
    func resizedForUpload(maxEdge: CGFloat) -> UIImage {
        let maxSide = max(size.width, size.height)
        guard maxSide > maxEdge else { return self }
        let scale = maxEdge / maxSide
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}
