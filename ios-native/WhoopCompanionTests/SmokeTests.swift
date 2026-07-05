import XCTest
@testable import WhoopCompanion

final class SmokeTests: XCTestCase {
    func testAppURLIsHTTPS() {
        XCTAssertEqual(WebAppView.appURL.scheme, "https")
        XCTAssertEqual(WebAppView.appURL.host, "whoop-companion.lovable.app")
    }
}
