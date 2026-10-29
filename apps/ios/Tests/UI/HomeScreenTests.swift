import XCTest

/// Home on a real backend (brief, Stage I3): Lakshmi sees Metoprolol at 3
/// days, Arun sees the inhaler in doses, and moving the clock with the dev
/// route counts the days down on screen without a relaunch.
final class HomeScreenTests: XCTestCase {
    let dev = DevRoutes.testBackend

    @MainActor
    private func launch(member: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", dev.base, "-member-id", member, "-tab", "home"]
        app.launch()
        return app
    }

    @MainActor
    func testLakshmiSeesMetoprololAtThreeDaysInTelugu() async throws {
        try await dev.reset()
        let app = launch(member: "patient")
        let cover = app.staticTexts["cover-med_chronic_1"]
        XCTAssertTrue(cover.waitForExistence(timeout: 15))
        XCTAssertTrue(cover.label.hasPrefix("3"), cover.label)
        XCTAssertGreaterThan(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Metoprolol'")).count, 0)
        XCTAssertEqual(app.staticTexts["stock-med_chronic_1"].label, "6 మాత్రలు మిగిలాయి")
        XCTAssertTrue(app.staticTexts["తప్పకుండా వేసుకోవాలి"].exists)
    }

    @MainActor
    func testArunSeesHisInhalerInDosesAndHisMothersRecord() async throws {
        try await dev.reset()
        let app = launch(member: "rp")
        XCTAssertTrue(app.staticTexts["20 doses left"].waitForExistence(timeout: 15))
        // Lakshmi shares her record in full with Arun (consent in onboarding).
        XCTAssertTrue(app.staticTexts["Lakshmi's medicines"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testKavyaDoesNotSeeHerMothersRecord() async throws {
        try await dev.reset()
        let app = launch(member: "member_3")
        XCTAssertTrue(app.staticTexts["15 pills left"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["Lakshmi's medicines"].exists)
    }

    @MainActor
    func testMovingTheClockCountsTheDaysDownWithoutARelaunch() async throws {
        try await dev.reset()
        let app = launch(member: "patient")
        let cover = app.staticTexts["cover-med_chronic_1"]
        XCTAssertTrue(cover.waitForExistence(timeout: 15))
        XCTAssertTrue(cover.label.hasPrefix("3"), cover.label)
        try await dev.moveClock(to: "2026-10-07T09:12:00+05:30")
        let two = expectation(for: NSPredicate(format: "label BEGINSWITH '2'"), evaluatedWith: cover)
        await fulfillment(of: [two], timeout: 15)
        XCTAssertTrue(app.staticTexts["stock-med_chronic_1"].label.contains("6 అక్టో"), app.staticTexts["stock-med_chronic_1"].label)
    }
}
