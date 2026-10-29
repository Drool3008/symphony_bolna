import Foundation
import Testing
@testable import Vantari

/// A home read from the recorded fixtures, with some fields changed.
func recordedHome(_ name: String, _ change: (inout [String: Any]) -> Void = { _ in }) throws -> Data {
    var json = try #require(try JSONSerialization.jsonObject(with: Fixtures.data(name)) as? [String: Any])
    change(&json)
    return try JSONSerialization.data(withJSONObject: json)
}

@Suite("Home's words")
struct HomeLinesTests {
    let te = Strings(language: "te-IN")
    let en = Strings(language: "en-IN")

    func home(_ name: String) throws -> MemberHomeResponse {
        try JSONDecoder().decode(MemberHomeResponse.self, from: Fixtures.data(name))
    }

    @Test func givesLakshmisStockInPillsInTelugu() throws {
        let home = try home("home-patient-as-patient.json")
        let metoprolol = try #require(home.medicines.first)
        #expect(metoprolol.daysOfCover == 3)
        #expect(HomeLines.stock(metoprolol, te, today: home.today) == "6 మాత్రలు మిగిలాయి")
    }

    @Test func givesArunsInhalerInDoses() throws {
        let home = try home("home-rp-as-rp.json")
        let inhaler = try #require(home.medicines.first { $0.unit == "doses" })
        #expect(HomeLines.stock(inhaler, en, today: home.today) == "20 doses left")
    }

    @Test func saysTheStockIsAsCountedOnceTheClockHasMovedPastThatDay() throws {
        let metoprolol = try #require(try home("home-patient-as-patient.json").medicines.first)
        #expect(HomeLines.stock(metoprolol, en, today: "2026-10-07") == "6 pills left when counted on 6 Oct")
    }

    @Test func showsTheBPCheckAsOverdueSinceTheDayItFellDue() throws {
        let home = try home("home-patient-as-patient.json")
        let bp = try #require(home.tests.first)
        #expect(bp.daysUntilDue < 0)
        #expect(HomeLines.due(bp, en, today: home.today) == "overdue since 4 Sep")
        #expect(HomeLines.due(bp, te, today: home.today).hasSuffix("నుండి గడువు దాటింది"))
        #expect(HomeLines.lastDone(bp, en, today: home.today) == "last done 6 Jun · every 90 days")
    }

    @Test func givesATestDueNextYearItsYear() throws {
        let home = try home("home-rp-as-rp.json")
        let spirometry = try #require(home.tests.first { $0.name == "Spirometry" })
        #expect(HomeLines.due(spirometry, en, today: home.today) == "due 18 Jul 2027")
    }
}

@MainActor
@Suite("The home store")
struct HomeStoreTests {
    let book = PathStubProtocol.Book()

    func store() -> HomeStore {
        let identity = Identity(suiteName: "HomeStoreTests")
        identity.choose("patient")
        return HomeStore(api: APIClient(base: book.base, session: book.session, identity: identity))
    }

    func event(_ json: String) throws -> StreamEvent {
        try JSONDecoder().decode(StreamEvent.self, from: Data(json.utf8))
    }

    func settle(_ done: () -> Bool) async {
        for _ in 0..<200 where !done() { try? await Task.sleep(for: .milliseconds(5)) }
    }

    @Test func readsTheMemberAndTheFamilyAsTheServerFilteredThem() async throws {
        book.answer("/api/members/patient/home", try Fixtures.data("home-patient-as-patient.json"))
        book.answer("/api/members/rp/home", try Fixtures.data("home-rp-as-rp.json"))
        let homes = store()
        await homes.show(["patient", "rp"])
        #expect(homes.homes["patient"]?.medicines.first?.name == "Metoprolol")
        #expect(homes.homes["rp"] != nil)
        #expect(book.requests.allSatisfy { $0.value(forHTTPHeaderField: "X-Member-Id") == "patient" })
    }

    @Test func readsAgainWhenTheClockMovesAndCountsTheDaysDown() async throws {
        book.answer("/api/members/patient/home", try Fixtures.data("home-patient-as-patient.json"))
        let homes = store()
        await homes.show(["patient"])
        book.answer("/api/members/patient/home", try recordedHome("home-patient-as-patient.json") { json in
            json["today"] = "2026-10-07"
            var medicines = json["medicines"] as! [[String: Any]]
            medicines[0]["days_of_cover"] = 2
            json["medicines"] = medicines
        })
        let moved = try event(#"{"seq":5,"type":"clock","at":"w","clock":"2026-10-07T03:42:00.000Z","source":"test","reached":[]}"#)
        // A replay brings many clock events at once: they make one read, not one each.
        homes.hear(moved)
        homes.hear(moved)
        homes.hear(moved)
        await settle { homes.homes["patient"]?.medicines.first?.daysOfCover == 2 }
        #expect(homes.homes["patient"]?.medicines.first?.daysOfCover == 2)
        #expect(book.paths().count == 2)
    }

    @Test func drawsNothingForTheLatestWordWhileTheServerSendsNull() throws {
        let home = try JSONDecoder().decode(MemberHomeResponse.self, from: Fixtures.data("home-patient-as-patient.json"))
        #expect(home.latestAgentWord == nil)
        #expect(LatestWordView.shown(home.latestAgentWord) == nil)
        #expect(LatestWordView.shown("  ") == nil)
    }

    @Test func fillsTheLatestWordInWhenTheAgentWritesToThisMember() async throws {
        book.answer("/api/members/patient/home", try Fixtures.data("home-patient-as-patient.json"))
        let homes = store()
        await homes.show(["patient"])
        #expect(LatestWordView.shown(homes.homes["patient"]?.latestAgentWord) == nil)
        // The stub script's own message to Lakshmi (config/stub-script.json).
        book.answer("/api/members/patient/home", try recordedHome("home-patient-as-patient.json") { json in
            json["latest_agent_word"] = "అమ్మా, మీ మాత్రలు ఆర్డర్ అయ్యాయి. కెమిస్ట్\u{200C}కి పేమెంట్ అయింది. మీకు డెలివరీ చేయించడానికి ప్రయత్నిస్తున్నాను."
        })
        // A message in another member's thread is not this home's business.
        homes.hear(try event(#"{"seq":7,"type":"message","at":"w","clock":"c","message":{"id":"m1","thread":"rp","from":"agent","to":"rp","text":"x","language":"en-IN","kind":null,"card":null,"answer":null,"answered_at":null,"timed_out_at":null,"at":"c"}}"#))
        await settle { book.paths().count > 1 }
        #expect(book.paths().count == 1)
        homes.hear(try event(#"{"seq":8,"type":"message","at":"w","clock":"c","message":{"id":"m2","thread":"patient","from":"agent","to":"patient","text":"y","language":"te-IN","kind":null,"card":null,"answer":null,"answered_at":null,"timed_out_at":null,"at":"c"}}"#))
        await settle { homes.homes["patient"]?.latestAgentWord != nil }
        #expect(LatestWordView.shown(homes.homes["patient"]?.latestAgentWord) == "అమ్మా, మీ మాత్రలు ఆర్డర్ అయ్యాయి. కెమిస్ట్\u{200C}కి పేమెంట్ అయింది. మీకు డెలివరీ చేయించడానికి ప్రయత్నిస్తున్నాను.")
    }

    @Test func keepsWhatIsOnScreenAndSaysWhyWhenARefreshFails() async throws {
        book.answer("/api/members/patient/home", try Fixtures.data("home-patient-as-patient.json"))
        let homes = store()
        await homes.show(["patient"])
        book.answer("/api/members/patient/home", status: 400, try Fixtures.data("error-missing-member.json"))
        await homes.reload()
        #expect(homes.homes["patient"] != nil)
        #expect(homes.problems["patient"] == .refused(status: 400, reason: "X-Member-Id is required: say which family member is asking"))
    }

    @Test func forgetsEverythingOnANewRun() async throws {
        book.answer("/api/members/patient/home", try Fixtures.data("home-patient-as-patient.json"))
        let homes = store()
        await homes.show(["patient"])
        homes.clear()
        #expect(homes.homes.isEmpty)
        await homes.refetch()
        #expect(homes.homes["patient"] != nil)
    }
}
