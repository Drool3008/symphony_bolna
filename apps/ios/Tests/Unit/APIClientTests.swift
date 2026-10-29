import Foundation
import Testing
@testable import Vantari

@Suite("The API client", .serialized)
struct APIClientTests {
    let identity = Identity(suiteName: "APIClientTests")
    let base = URL(string: "http://localhost:8799")!

    init() {
        identity.forget()
        StubURLProtocol.seen = []
        StubURLProtocol.answer = .init()
    }

    func client() -> APIClient {
        APIClient(base: base, session: StubURLProtocol.session(), identity: identity)
    }

    @Test func sendsWhoIsAskingFromTheIdentity() async throws {
        identity.choose("rp")
        StubURLProtocol.answer.body = try Fixtures.data("home-patient-as-rp.json")
        let home = try await client().home("patient")
        let request = try #require(StubURLProtocol.seen.first)
        #expect(request.url?.absoluteString == "http://localhost:8799/api/members/patient/home")
        #expect(request.value(forHTTPHeaderField: "X-Member-Id") == "rp")
        #expect(home.shared == .full)
    }

    @Test func namesNobodyBeforeAPick() async throws {
        StubURLProtocol.answer.body = try Fixtures.data("members.json")
        _ = try await client().members()
        #expect(StubURLProtocol.seen.first?.value(forHTTPHeaderField: "X-Member-Id") == nil)
    }

    @Test func postsJSONInTheServersFieldNames() async throws {
        identity.choose("rp")
        StubURLProtocol.answer.body = try Fixtures.data("reply-card.json")
        _ = try await client().reply(ReplyRequest(action: "Approve", messageId: "m1"))
        let body = try #require(StubURLProtocol.seen.first?.httpBody)
        let sent = try JSONSerialization.jsonObject(with: body) as? [String: String]
        #expect(sent == ["action": "Approve", "message_id": "m1"])
    }

    @Test func passesOnTheServersOwnReasonWhenItRefuses() async throws {
        StubURLProtocol.answer = .init(status: 409, body: try Fixtures.data("error-card-answered.json"))
        await #expect(throws: APIError.refused(status: 409, reason: "that card is already answered")) {
            try await client().reply(ReplyRequest(action: "Approve", messageId: "m1"))
        }
    }

    @Test func saysTheStatusWhenTheBodyIsNotTheServersJSON() async throws {
        StubURLProtocol.answer = .init(status: 502, body: Data("<html>Bad gateway</html>".utf8))
        await #expect(throws: APIError.refused(status: 502, reason: "The server answered 502.")) {
            try await client().members()
        }
    }

    @Test func saysItIsOfflineWhenTheServerCannotBeReached() async throws {
        StubURLProtocol.answer.fail = .cannotConnectToHost
        await #expect(throws: APIError.offline) { try await client().members() }
        #expect(APIError.offline.message == "The app cannot reach the family's server right now.")
    }

    @Test func remembersOnlyTheMemberId() {
        identity.choose("member_3")
        #expect(Identity(suiteName: "APIClientTests").memberId == "member_3")
        #expect(identity.headers == ["X-Member-Id": "member_3"])
        identity.forget()
        #expect(identity.headers.isEmpty)
    }
}
