import Foundation

enum TodayDate {
    static func string(from date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let day = calendar.component(.day, from: date)
        let suffix: String
        switch day % 100 {
        case 11...13: suffix = "th"
        default:
            switch day % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.calendar = calendar
        formatter.timeZone = timeZone
        formatter.dateFormat = "EEEE"
        let weekday = formatter.string(from: date)
        formatter.dateFormat = "MMMM yyyy"
        return "\(weekday), \(day)\(suffix) \(formatter.string(from: date))"
    }
}