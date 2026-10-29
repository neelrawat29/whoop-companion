import XCTest
@testable import WhoopCompanion

final class TodayDateTests: XCTestCase {
    func testRequestedDateFormat() {
        guard let zone = TimeZone(secondsFromGMT: 0) else {
            return XCTFail("UTC unavailable")
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        guard let date = calendar.date(from: DateComponents(year: 2026, month: 10, day: 28)) else {
            return XCTFail("Invalid reference date")
        }
        XCTAssertEqual(TodayDate.string(from: date, timeZone: zone), "Wednesday, 28th October 2026")
    }

    func testOrdinalDayExceptions() {
        guard let zone = TimeZone(secondsFromGMT: 0) else {
            return XCTFail("UTC unavailable")
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        for (day, ordinal) in [(1, "1st"), (2, "2nd"), (3, "3rd"), (11, "11th"), (12, "12th"), (13, "13th"), (21, "21st"), (22, "22nd"), (23, "23rd"), (31, "31st")] {
            guard let date = calendar.date(from: DateComponents(year: 2026, month: 10, day: day)) else {
                return XCTFail("Invalid day")
            }
            XCTAssertTrue(TodayDate.string(from: date, timeZone: zone).contains(", \(ordinal) October 2026"))
        }
    }

    func testDayStartsAt4am() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
            calendar.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
        }
        func dayOf(_ d: Date) -> Int { calendar.component(.day, from: TodayDate.appDay(now: d, calendar: calendar)) }
        XCTAssertEqual(dayOf(at(30, 0, 36)), 29)  // just after midnight: still the 29th
        XCTAssertEqual(dayOf(at(30, 3, 59)), 29)
        XCTAssertEqual(dayOf(at(30, 4, 0)), 30)   // new day from 4am
        XCTAssertEqual(dayOf(at(30, 23, 59)), 30)
        XCTAssertEqual(dayOf(at(1, 1)), 30)        // across a month boundary (Oct 1 → Sep 30)
        XCTAssertTrue(TodayDate.isAppToday(at(29, 12), now: at(30, 1), calendar: calendar))
        XCTAssertFalse(TodayDate.isAppToday(at(30, 12), now: at(30, 1), calendar: calendar))
    }
}
