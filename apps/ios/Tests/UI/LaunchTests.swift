import XCTest

/// A smoke test per stage. The Makefile starts a backend of its own for these
/// and passes its address as TEST_RUNNER_API_BASE.
final class LaunchTests: XCTestCase {
    private var backend: String {
        ProcessInfo.processInfo.environment["API_BASE"] ?? "http://localhost:8799"
    }

    /// Launches with no member picked (an empty `member-id` in UserDefaults' argument domain).
    @MainActor
    private func launch(member: String = "") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", backend, "-member-id", member]
        app.launch()
        return app
    }

    @MainActor
    func testAFreshPhoneShowsThePickerWithTheFamilyFromTheServer() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["DEVELOPMENT IDENTITY"].waitForExistence(timeout: 15))
        for name in ["Lakshmi", "Arun", "Kavya"] {
            XCTAssertTrue(app.buttons[name].exists, "\(name) is not on the picker")
        }
    }

    @MainActor
    func testPickingAMemberMakesTheAppTheirs() {
        let app = launch()
        XCTAssertTrue(app.buttons["Lakshmi"].waitForExistence(timeout: 15))
        let lakshmi = app.buttons["Lakshmi"]
        expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: lakshmi)
        waitForExpectations(timeout: 15)
        lakshmi.tap()
        // On the first launch after the unit tests, a tap is now and then lost
        // with the picker still up and every button hittable; a second tap on
        // the same name is the same pick.
        if !app.staticTexts["member-name"].waitForExistence(timeout: 5), lakshmi.exists { lakshmi.tap() }
        guard app.staticTexts["member-name"].waitForExistence(timeout: 15) else {
            return XCTFail("still on the picker after the tap:\n\(app.debugDescription)")
        }
        XCTAssertEqual(app.staticTexts["member-name"].label, "Lakshmi")
    }

    @MainActor
    func testAPhoneAlreadyPickedOpensStraightIntoTheApp() {
        let app = launch(member: "rp")
        XCTAssertTrue(app.staticTexts["member-name"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.staticTexts["member-name"].label, "Arun")
    }
}
