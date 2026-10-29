import XCTest

/// A smoke test per stage: the app launches on the simulator and stays up.
final class LaunchTests: XCTestCase {
    @MainActor
    func testLaunchesAndStaysInTheForeground() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }
}
