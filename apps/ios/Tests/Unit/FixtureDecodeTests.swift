import Foundation
import Testing
@testable import Vantari

/// Every recorded fixture decodes into the model that mirrors it. A failure
/// here after the backend changed means a model is stale: rerun
/// scripts/record-fixtures.mjs and fix the model, never the fixture.
@Suite("Recorded server answers decode")
struct FixtureDecodeTests {
    let decoder = JSONDecoder()

    @Test func members() throws {
        let body = try decoder.decode(MembersResponse.self, from: Fixtures.data("members.json"))
        #expect(body.members.map(\.name) == ["Lakshmi", "Arun", "Kavya"])
        #expect(body.members.first?.role == .patient)
        #expect(body.members.first?.language == "te-IN")
    }

    @Test(arguments: [
        "home-patient-as-patient.json", "home-rp-as-rp.json", "home-member_3-as-member_3.json",
        "home-patient-as-rp.json", "home-patient-as-member_3.json",
    ])
    func home(_ name: String) throws {
        _ = try decoder.decode(MemberHomeResponse.self, from: Fixtures.data(name))
    }

    @Test func lakshmiAtTheStart() throws {
        let home = try decoder.decode(MemberHomeResponse.self, from: Fixtures.data("home-patient-as-patient.json"))
        let metoprolol = try #require(home.medicines.first { $0.name == "Metoprolol" })
        #expect(metoprolol.daysOfCover == 3)
        let bp = try #require(home.tests.first { $0.name == "BP check" })
        #expect(bp.overdue && bp.daysUntilDue < 0)
    }

    @Test func statusOnlyEmptiesTheLists() throws {
        let home = try decoder.decode(MemberHomeResponse.self, from: Fixtures.data("home-patient-as-member_3.json"))
        #expect(home.shared == .statusOnly && home.medicines.isEmpty && home.tests.isEmpty)
    }

    @Test func routeAnswers() throws {
        #expect(try decoder.decode(ReplyResponse.self, from: Fixtures.data("reply-card.json")).delivered)
        #expect(try decoder.decode(InputResponse.self, from: Fixtures.data("input.json")).routed == .input)
        #expect(try decoder.decode(ForwardResponse.self, from: Fixtures.data("forward.json")).ok)
        let sent = try decoder.decode(ChatSendResponse.self, from: Fixtures.data("chat-send.json"))
        #expect(sent.key == "dm:member_3:rp" && !sent.message.toAgent)
    }

    @Test func refusals() throws {
        let missing = try decoder.decode(ErrorBody.self, from: Fixtures.data("error-missing-member.json"))
        #expect(missing.error.contains("X-Member-Id is required"))
        let twice = try decoder.decode(ErrorBody.self, from: Fixtures.data("error-card-answered.json"))
        #expect(twice.error == "that card is already answered")
    }

    @Test func everyJSONFixtureIsCovered() {
        let covered: Set = [
            "members.json", "home-patient-as-patient.json", "home-rp-as-rp.json", "home-member_3-as-member_3.json",
            "home-patient-as-rp.json", "home-patient-as-member_3.json", "reply-card.json", "input.json",
            "forward.json", "chat-send.json", "error-missing-member.json", "error-card-answered.json",
        ]
        let recorded = Set(Fixtures.names.filter { $0.hasSuffix(".json") })
        #expect(recorded == covered, "a fixture was recorded that no test decodes, or one went missing")
    }
}
