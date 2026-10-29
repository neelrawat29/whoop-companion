import Foundation

enum TodayDate {
    /// The app's day starts at 4am, not midnight: late-night logs belong to the
    /// evening they're part of, and Today stays on that day until 4am.
    /// Must match DAY_START_HOUR in src/lib/recovery.ts.
    static let dayStartHour = 4

    /// A moment on the app's current day — yesterday before 4am, otherwise now.
    /// Use it wherever the app decides which day to show or save to.
    static func appDay(now: Date = Date(), calendar: Calendar = .current) -> Date {
        calendar.component(.hour, from: now) < dayStartHour
            ? calendar.date(byAdding: .day, value: -1, to: now) ?? now
            : now
    }

    /// True when `date` falls on the app's current day.
    static func isAppToday(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> Bool {
        calendar.isDate(date, inSameDayAs: appDay(now: now, calendar: calendar))
    }

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