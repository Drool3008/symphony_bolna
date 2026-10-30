import XCTest

/// The agent conversation on a real backend (brief, Stage I4): the default
/// stub take (Section 7), driven with the dev routes, reaches Arun's phone as
/// it happens.
final class AgentChatTests: XCTestCase {
    let dev = DevRoutes.testBackend

    @MainActor
    private func launch(member: String, tab: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-API_BASE", dev.base, "-member-id", member, "-tab", tab]
        app.launch()
        XCTAssertTrue(app.staticTexts["member-name"].waitForExistence(timeout: 15))
        return app
    }

    /// The take up to Arun's card: the refill check, then the two chemists
    /// with the answers on file (as scripts/record-fixtures.mjs plays them).
    @MainActor
    private func driveToArunsCard() async throws {
        try await dev.moveClockToNextDate()
        try await dev.answerNextCall(variant: "chemist_substitute_only")
        try await dev.answerNextCall(variant: "chemist_in_stock_kazipet")
    }

    @MainActor
    func testArunsCardOpensChatOnItsOwnAndWaitsOnHim() async throws {
        try await dev.reset()
        let app = launch(member: "rp", tab: "home")
        XCTAssertTrue(app.buttons["tab-home"].isSelected)
        try await driveToArunsCard()
        // A card for him takes him to Chat (the reference's lastCard effect).
        let band = app.staticTexts.matching(NSPredicate(format: "identifier BEGINSWITH 'card-band-'")).firstMatch
        XCTAssertTrue(band.waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["tab-agent"].isSelected)
        XCTAssertEqual(band.label, "YOUR DECISION")
        XCTAssertTrue(app.staticTexts["₹320"].exists)
    }

    @MainActor
    func testLakshmiSeesTheAgentsTeluguAndNotArunsCard() async throws {
        try await dev.reset()
        try await driveToArunsCard()
        // Arun answers once the agent waits on him; until then a reply is not delivered.
        for _ in 0..<100 {
            let answer = try await dev.call("POST", "/api/reply", member: "rp", body: ["action": "Approve"]) as? [String: Any]
            if answer?["delivered"] as? Bool == true { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        let app = launch(member: "patient", tab: "agent")
        let telugu = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'అమ్మా'")).firstMatch
        XCTAssertTrue(telugu.waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["₹320"].exists)
    }
}
