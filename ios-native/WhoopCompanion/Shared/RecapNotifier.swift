import Foundation
import UserNotifications

/// Schedules the daily End-of-day Recap nudge.
///
/// iOS only shows the permission prompt once, so we never ask at launch.
/// Today offers the reminder in context (after the user's first day) and
/// only then calls `requestAndScheduleDaily()`.
enum RecapNotifier {
    static let identifier = "cove.recap.daily"
    static let offerDismissedKey = "cove.recapReminder.offerDismissed"
    static let firstSeenKey = "cove.firstSeenDate"

    /// True when the user hasn't been asked yet (the prompt is still available).
    static func canAsk() async -> Bool {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .notDetermined
    }

    /// Re-schedules the reminder on launch for users who already allowed it. Never prompts.
    static func scheduleIfAuthorized(hour: Int = 21) async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }
        await schedule(hour: hour)
    }

    /// Shows the system prompt, then schedules the reminder if allowed.
    @discardableResult
    static func requestAndScheduleDaily(hour: Int = 21) async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return false }
        } catch { return false }
        await schedule(hour: hour)
        return true
    }

    private static func schedule(hour: Int) async {
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = "End-of-day recap"
        content.body = "Fill your remaining logs in one screen — takes under a minute."
        content.sound = .default

        var comps = DateComponents()
        comps.hour = hour
        comps.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
        let req = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        try? await center.add(req)
    }
}
