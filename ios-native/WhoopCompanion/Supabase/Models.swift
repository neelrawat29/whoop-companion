import Foundation

// MARK: - Date helpers

extension DateFormatter {
    static let entryDate: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone.current
        return f
    }()
}

extension Date {
    var entryDateString: String { DateFormatter.entryDate.string(from: self) }
}

// MARK: - Profile

struct Profile: Codable, Identifiable {
    let id: UUID
    var displayName: String?
    var heightCm: Double?
    var weightKg: Double?
    var weightUnit: String
    var weightGoalKg: Double?
    var weightGoalDate: String?
    var restingHrBaseline: Double?
    var dateOfBirth: String?
    var sex: String?
    var thresholdRest: Double
    var thresholdPush: Double

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case heightCm = "height_cm"
        case weightKg = "weight_kg"
        case weightUnit = "weight_unit"
        case weightGoalKg = "weight_goal_kg"
        case weightGoalDate = "weight_goal_date"
        case restingHrBaseline = "resting_hr_baseline"
        case dateOfBirth = "date_of_birth"
        case sex
        case thresholdRest = "threshold_rest"
        case thresholdPush = "threshold_push"
    }
}

// MARK: - Daily entry

struct DailyEntry: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let entryDate: String
    var recovery: Double?
    var hrv: Double?
    var rhr: Double?
    var sleepHours: Double?
    var sleepScore: Double?
    var source: String

    enum CodingKeys: String, CodingKey {
        case id, recovery, hrv, rhr, source
        case userId = "user_id"
        case entryDate = "entry_date"
        case sleepHours = "sleep_hours"
        case sleepScore = "sleep_score"
    }
}

// MARK: - Habits log

struct HabitsLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let entryDate: String
    var energy: Int?
    var mood: Int?
    var hydration: Double?
    var drinks: Int?
    var strain: Double?
    var note: String?
    var bedtime: String?
    var wakeTime: String?
    var workLocation: String?
    var supplements: [String]?

    enum CodingKeys: String, CodingKey {
        case id, energy, mood, hydration, drinks, strain, note, bedtime, supplements
        case userId = "user_id"
        case entryDate = "entry_date"
        case wakeTime = "wake_time"
        case workLocation = "work_location"
    }
}

// MARK: - Weight

struct WeightEntry: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let entryDate: String
    var weightKg: Double

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case entryDate = "entry_date"
        case weightKg = "weight_kg"
    }
}

// MARK: - Meals

struct Meal: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let entryDate: String
    var slot: String
    var description: String
    var kcal: Double?
    var proteinG: Double?
    var carbsG: Double?
    var fatG: Double?

    enum CodingKeys: String, CodingKey {
        case id, slot, description, kcal
        case userId = "user_id"
        case entryDate = "entry_date"
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
    }
}

// MARK: - Supplements

struct UserSupplement: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var name: String
    var brand: String?
    var servingSize: String?
    var calories: Double?
    var proteinG: Double?
    var carbsG: Double?
    var fatG: Double?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case id, name, brand, calories, notes
        case userId = "user_id"
        case servingSize = "serving_size"
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
    }
}

// MARK: - Groups

struct Group: Codable, Identifiable {
    let id: UUID
    let name: String
    let icon: String?
    let inviteCode: String
    let createdBy: UUID

    enum CodingKeys: String, CodingKey {
        case id, name, icon
        case inviteCode = "invite_code"
        case createdBy = "created_by"
    }
}

struct LeaderboardRow: Codable, Identifiable {
    var id: UUID { userId }
    let userId: UUID
    let displayName: String
    let daysLogged7d: Int
    let currentStreak: Int
    let avgRecovery7d: Double?
    let avgSleepHours7d: Double?
    let avgEnergy7d: Double?
    let avgMood7d: Double?
    let loggedToday: Bool
    let isOwner: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case daysLogged7d = "days_logged_7d"
        case currentStreak = "current_streak"
        case avgRecovery7d = "avg_recovery_7d"
        case avgSleepHours7d = "avg_sleep_hours_7d"
        case avgEnergy7d = "avg_energy_7d"
        case avgMood7d = "avg_mood_7d"
        case loggedToday = "logged_today"
        case isOwner = "is_owner"
    }
}
