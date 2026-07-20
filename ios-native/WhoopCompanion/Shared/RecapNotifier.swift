import Foundation
import UserNotifications

/// Schedules the daily End-of-day Recap nudge.
enum RecapNotifier {
    static let identifier = "cove.recap.daily"

    static func requestAndScheduleDaily(hour: Int = 21) async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }
        } catch { return }

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
