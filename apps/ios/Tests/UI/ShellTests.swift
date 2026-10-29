import XCTest

/// Each member gets their own language and their own tabs (brief, Stage I2).
final class ShellTests: XCTestCase {
    private var backend: String {
        ProcessInfo.processInfo.environment["API_BASE"] ?? "http://localhost:8799"
    }

    @MainActor
    private func launch(member: String, tab: String = "home") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", backend, "-member-id", member, "-tab", tab]
        app.launch()
        XCTAssertTrue(app.staticTexts["member-name"].waitForExistence(timeout: 15))
        return app
    }

    @MainActor
    private func tabs(_ app: XCUIApplication) -> [String] {
        app.tabBars.firstMatch.buttons.allElementsBoundByIndex.map(\.label)
    }

    @MainActor
    func testLakshmiReadsTeluguAndHasNoWallet() {
        let app = launch(member: "patient")
        XCTAssertEqual(tabs(app), ["హోమ్", "చాట్", "కుటుంబం"])
        XCTAssertTrue(app.staticTexts["family-date"].waitForExistence(timeout: 15))
    }

    @MainActor
    func testArunReadsEnglishAndTheWalletStaysHiddenUntilItsRoutesExist() {
        let app = launch(member: "rp")
        XCTAssertEqual(tabs(app), ["Home", "Chat", "Family"])
        XCTAssertFalse(app.tabBars.buttons["Wallet"].exists)
    }

    @MainActor
    func testKavyaReadsEnglishAndHasNoWallet() {
        let app = launch(member: "member_3")
        XCTAssertEqual(tabs(app), ["Home", "Chat", "Family"])
    }

    @MainActor
    func testFamilySaysItWaitsOnTheServer() {
        let app = launch(member: "rp", tab: "family")
        XCTAssertTrue(app.staticTexts["family-waiting"].waitForExistence(timeout: 5))
        XCTAssertEqual(
            app.staticTexts["family-waiting"].label,
            "Family chats open here once the server can send them."
        )
    }
}
