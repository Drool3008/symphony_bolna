import Foundation
import Testing
@testable import Vantari

/// The agent thread rebuilt from the stream, as the web client's
/// src/data/agentThread.test.ts checks it, on the recorded take and on event
/// JSON shaped as the server sends it.
@MainActor
@Suite("The agent thread store")
struct ThreadStoreTests {
    func store() -> AgentThreadStore {
        AgentThreadStore(api: APIClient(base: URL(string: "http://localhost:1")!))
    }

    func event(_ json: String) throws -> StreamEvent {
        try JSONDecoder().decode(StreamEvent.self, from: Data(json.utf8))
    }

    /// Every event in the recorded take (scripts/record-fixtures.mjs), in order.
    func recordedTake() throws -> [StreamEvent] {
        var parser = SSEParser()
        return try parser.feed(try Fixtures.data("events.sse")).map {
            try JSONDecoder().decode(StreamEvent.self, from: Data($0.data.utf8))
        }
    }

    /// A message event, the agent's to Arun unless told otherwise.
    func message(_ id: String, seq: Int, from: String = "agent", card: String = "null", thread: String = "rp") throws -> StreamEvent {
        try event(#"""
        {"seq":\#(seq),"type":"message","at":"w","clock":"2026-10-08T18:30:00.000Z","message":{"id":"\#(id)","thread":"\#(thread)","from":"\#(from)","to":"\#(from == "agent" ? thread : "agent")","text":"line \#(id)","language":"en-IN","kind":null,"card":\#(card),"answer":null,"answered_at":null,"timed_out_at":null,"at":"2026-10-08T18:30:00.000Z"}}
        """#)
    }

    let spend = #"{"kind":"spend_above_threshold","amount_inr":320,"payee":"Kazipet Pharmacy","for":"Lakshmi","on_timeout":"hold the order unpaid and call you"}"#

    @Test func foldsTheRecordedTakeIntoEachMembersThread() throws {
        let threads = store()
        for e in try recordedTake() { threads.hear(e) }
        let arun = threads.messages(for: "rp")
        #expect(arun.allSatisfy { $0.thread == "rp" })
        let card = try #require(arun.first { $0.card != nil })
        #expect(card.answer == "Approve")
        // The answer's sim time is the envelope's clock, not its wall-time `at`.
        #expect(card.answeredAt == "2026-10-08T18:30:00.000Z")
        #expect(card.cardState == .yes)
        // His tap comes back as his own line, after the card.
        #expect(arun.contains { $0.from == "rp" && $0.text == "Approve" })
        // Lakshmi's thread holds the agent's Telugu, and nothing of Arun's.
        let lakshmi = threads.messages(for: "patient")
        #expect(lakshmi.contains { $0.language == "te-IN" })
        #expect(!lakshmi.contains { $0.id == card.id })
        // The wait on Arun opened and settled; the sync after the replay says none is open.
        #expect(threads.waits(on: "rp").isEmpty)
        #expect(threads.openCards(for: "rp").isEmpty)
    }

    @Test func countsTheOpenCardsUntilTheyAreAnsweredOrTimeOut() throws {
        let threads = store()
        threads.hear(try message("a", seq: 1, card: spend))
        threads.hear(try message("b", seq: 2, card: spend))
        threads.hear(try message("c", seq: 3))
        threads.hear(try message("r", seq: 4, card: #"{"kind":"order_receipt","total_inr":320}"#))
        #expect(threads.openCards(for: "rp").map(\.id) == ["a", "b"])
        #expect(threads.waitsOnAnswer(from: "rp"))
        threads.hear(try event(#"{"seq":5,"type":"card_answered","at":"w","clock":"2026-10-08T18:31:00.000Z","message_id":"a","answer":"Hold unpaid"}"#))
        #expect(threads.openCards(for: "rp").map(\.id) == ["b"])
        threads.hear(try event(#"{"seq":6,"type":"card_timed_out","at":"w","clock":"2026-10-08T18:33:00.000Z","message_id":"b","reason":"no_answer"}"#))
        #expect(threads.openCards(for: "rp").isEmpty)
        #expect(!threads.waitsOnAnswer(from: "rp"))
        let thread = threads.messages(for: "rp")
        #expect(thread[0].cardState == .other && thread[0].answeredAt == "2026-10-08T18:31:00.000Z")
        #expect(thread[1].cardState == .timedOut && thread[1].timedOutAt == "2026-10-08T18:33:00.000Z")
        #expect(thread[2].cardState == nil)
        #expect(thread[3].cardState == .record)
    }

    @Test func tellsAYesFromAnyOtherAnswer() {
        for yes in ["Approve", "yes", "Go ahead", "Yes, book it", "OK"] { #expect(CardLabels.isYes(yes), "\(yes)") }
        for other in ["Hold unpaid", "Not now", "Decline", "Call me", "Don't act"] { #expect(!CardLabels.isYes(other), "\(other)") }
        #expect(CardLabels.pastTense("Approve") == "Approved")
        #expect(CardLabels.pastTense("Hold unpaid") == "Held unpaid")
        #expect(CardLabels.pastTense("Call me") == "Call me")
    }

    @Test func keepsTheWaitsOnEachMemberFromSyncAndAsTheyOpenAndSettle() throws {
        let threads = store()
        threads.hear(try event(#"{"seq":1,"type":"awaiting_reply","at":"w","clock":"c","id":"w1","from":"rp","what_for":"approve the Metoprolol refill from Kazipet Pharmacy","wait_seconds":180,"deadline":"d"}"#))
        threads.hear(try event(#"{"seq":2,"type":"awaiting_reply","at":"w","clock":"c","id":"w2","from":"patient","what_for":"how she feels","wait_seconds":180,"deadline":"d"}"#))
        #expect(threads.waits(on: "rp").map(\.whatFor) == ["approve the Metoprolol refill from Kazipet Pharmacy"])
        #expect(threads.waitsOnAnswer(from: "rp"))
        threads.hear(try event(#"{"seq":3,"type":"reply_settled","at":"w","clock":"c","id":"w1","from":"rp","result":{"answered":true,"from":"rp","text":null,"action":"Approve","at":"c"}}"#))
        #expect(threads.waits(on: "rp").isEmpty)
        #expect(threads.waits(on: "patient").count == 1)
        threads.hear(try event(#"{"type":"sync","at":"w","clock":"c","stage":6,"generation":2,"waits":[{"id":"w3","member":"rp","what_for":"x","deadline":"d"}]}"#))
        #expect(threads.waits(on: "rp").map(\.id) == ["w3"])
        #expect(threads.waits(on: "patient").isEmpty)
    }

    @Test func countsTheAgentsLinesNotSeenSinceChatWasOpen() throws {
        let threads = store()
        threads.hear(try message("a", seq: 1))
        threads.hear(try message("b", seq: 2, card: spend))
        threads.hear(try message("mine", seq: 3, from: "rp"))
        threads.hear(try message("other", seq: 4, thread: "patient"))
        #expect(threads.unread(for: "rp") == 2)
        threads.markSeen("rp")
        #expect(threads.unread(for: "rp") == 0)
        threads.hear(try message("c", seq: 5))
        #expect(threads.unread(for: "rp") == 1)
        #expect(threads.unread(for: "patient") == 1)
    }

    /// The reference opens Chat when a card arrives (src/PhoneApp.tsx, lastCard);
    /// cards in the replay are history and must not pull every launch onto Chat.
    @Test func marksACardThatArrivesLiveButNotOneFromTheReplay() throws {
        let threads = store()
        threads.hear(try message("old", seq: 1, card: spend))
        #expect(threads.arrivedCard == nil)
        threads.hear(try event(#"{"type":"sync","at":"w","clock":"c","stage":6,"generation":1}"#))
        threads.hear(try message("plain", seq: 2))
        #expect(threads.arrivedCard == nil)
        threads.hear(try message("new", seq: 3, card: spend))
        #expect(threads.arrivedCard?.id == "new" && threads.arrivedCard?.thread == "rp")
    }

    @Test func forgetsEverythingOnANewRun() throws {
        let threads = store()
        threads.hear(try message("a", seq: 1, card: spend))
        threads.clear()
        #expect(threads.messages(for: "rp").isEmpty && threads.waits.isEmpty)
    }

    /// A fresh connection's replay opens with the reset that began the run.
    /// Taken as a new run, it cleared the thread the replay then refilled, and
    /// the sync after it cleared it again, so a launch showed an empty chat.
    @Test func aReplayThatOpensWithTheRunsOwnResetKeepsTheThread() throws {
        let model = AppModel()
        let threads = store()
        model.register(threads)
        model.apply(try event(#"{"seq":1,"type":"reset","at":"w","clock":"2026-10-06T03:42:00.000Z","reason":"operator reset"}"#))
        model.apply(try message("card", seq: 2, card: spend))
        model.apply(try event(#"{"type":"sync","at":"w","clock":"c","stage":6,"generation":3}"#))
        #expect(threads.messages(for: "rp").map(\.id) == ["card"])
        #expect(model.session.generation == 3)
    }
}
