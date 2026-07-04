import XCTest
@testable import WhoopCompanion

final class SmokeTests: XCTestCase {
    func testEntryDateFormat() {
        let d = DateFormatter.entryDate.date(from: "2026-07-04")
        XCTAssertNotNil(d)
    }
}
