import XCTest

/// A smoke test per stage. The Makefile starts a backend of its own for these
/// and passes its address as TEST_RUNNER_API_BASE.
final class LaunchTests: XCTestCase {
    private var backend: String {
        ProcessInfo.processInfo.environment["API_BASE"] ?? "http://localhost:8799"
    }

    @MainActor
    func testLaunchesAndStaysInTheForeground() {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", backend]
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    }

    @MainActor
    func testReachesTheFamilyOnTheServer() {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", backend]
        app.launch()
        let marker = app.otherElements["backend"]
        XCTAssertTrue(marker.waitForExistence(timeout: 10))
        let reached = NSPredicate(format: "label == 'members 3'")
        expectation(for: reached, evaluatedWith: marker)
        waitForExpectations(timeout: 15)
    }
}
