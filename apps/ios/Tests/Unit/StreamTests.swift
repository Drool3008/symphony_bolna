import Foundation
import Testing
@testable import Vantari

@Suite("The stream parser")
struct SSEParserTests {
    let recorded: [UInt8]

    init() throws {
        recorded = Array(try Fixtures.data("events.sse"))
    }

    func frames(chunk size: Int) -> [SSEFrame] {
        var parser = SSEParser()
        var frames: [SSEFrame] = []
        var index = 0
        while index < recorded.count {
            let end = min(index + size, recorded.count)
            frames += parser.feed(recorded[index..<end])
            index = end
        }
        return frames
    }

    @Test func readsTheRecordedTakeAndEndsOnSync() throws {
        let all = frames(chunk: recorded.count)
        #expect(all.count > 50)
        #expect(all.last?.id == nil)
        #expect(all.last?.data.contains("\"type\":\"sync\"") == true)
        #expect(all.first?.id == "1")
    }

    /// Chunks of 1 byte split every Telugu character, which is three bytes in UTF-8.
    @Test(arguments: [1, 2, 3, 7, 64, 1000])
    func givesTheSameEventsHoweverTheBytesAreSplit(size: Int) {
        #expect(frames(chunk: size) == frames(chunk: recorded.count))
    }

    @Test func takesCRLFAndCREvenACRLFSplitAcrossChunks() {
        var parser = SSEParser()
        let first = parser.feed(Array("id: 7\r\ndata: {\"a\":1}\r".utf8))
        let second = parser.feed(Array("\n\r\n".utf8))
        #expect(first.isEmpty)
        #expect(second == [SSEFrame(id: "7", event: nil, data: "{\"a\":1}")])
    }

    @Test func skipsKeepaliveCommentsAndJoinsMultilineData() {
        var parser = SSEParser()
        let frames = parser.feed(Array(": keepalive\n\ndata: one\ndata: two\n\n".utf8))
        #expect(frames == [SSEFrame(id: nil, event: nil, data: "one\ntwo")])
    }
}

@Suite("Recorded events decode")
struct StreamEventDecodeTests {
    @Test func everyRecordedEventIsATypeTheAppKnows() throws {
        var parser = SSEParser()
        let frames = parser.feed(try Fixtures.data("events.sse"))
        let decoder = JSONDecoder()
        var types: Set<String> = []
        for frame in frames {
            let event = try decoder.decode(StreamEvent.self, from: Data(frame.data.utf8))
            if case .unknown = event.body { Issue.record("unknown event type \(event.type)") }
            types.insert(event.type)
        }
        for expected in ["sync", "reset", "clock", "input", "decision", "message", "awaiting_reply", "card_answered", "reply_settled"] {
            #expect(types.contains(expected), "the recorded take has no \(expected)")
        }
    }

    @Test func arunsCardAndLakshmisTeluguMessageArriveAsMessages() throws {
        var parser = SSEParser()
        let decoder = JSONDecoder()
        let messages = try parser.feed(try Fixtures.data("events.sse")).compactMap { frame -> ThreadMessage? in
            if case let .message(m) = try decoder.decode(StreamEvent.self, from: Data(frame.data.utf8)).body { return m.message }
            return nil
        }
        let card = try #require(messages.first { $0.thread == "rp" && $0.card != nil })
        #expect(card.card?["kind"]?.string == "spend_above_threshold")
        #expect(card.card?["buttons"] == nil, "the default take's card names no buttons (backend ask)")
        let telugu = try #require(messages.first { $0.thread == "patient" && $0.from == "agent" })
        #expect(telugu.language == "te-IN")
    }

    @Test func anUnknownTypeIsIgnoredNotACrash() throws {
        let json = #"{"seq":9,"type":"something_new","at":"a","clock":"c","whatever":1}"#
        let event = try JSONDecoder().decode(StreamEvent.self, from: Data(json.utf8))
        guard case .unknown = event.body else { Issue.record("expected unknown"); return }
    }
}

/// Serves a scripted series of stream connections.
final class StreamStubProtocol: URLProtocol {
    nonisolated(unsafe) static var connections: [[String]] = []
    nonisolated(unsafe) static var seen: [URLRequest] = []

    static func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StreamStubProtocol.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.seen.append(request)
        guard !Self.connections.isEmpty else { return } // Hang: no more connections scripted.
        let chunks = Self.connections.removeFirst()
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "text/event-stream"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        for chunk in chunks { client?.urlProtocol(self, didLoad: Data(chunk.utf8)) }
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite("The live stream", .serialized)
struct LiveStreamTests {
    static func event(_ seq: Int) -> String {
        "id: \(seq)\ndata: {\"seq\":\(seq),\"type\":\"clock\",\"at\":\"a\",\"clock\":\"c\",\"source\":\"s\",\"reached\":[]}\n\n"
    }

    static let sync = "data: {\"type\":\"sync\",\"at\":\"a\",\"clock\":\"c\",\"stage\":1,\"generation\":1}\n\n"

    @Test func resumesAfterADropFromTheLastEventItSaw() async throws {
        StreamStubProtocol.seen = []
        StreamStubProtocol.connections = [[Self.event(1), Self.event(2) + Self.sync], [Self.event(3) + Self.sync]]
        let stream = LiveStream(
            base: URL(string: "http://localhost:8799")!, session: StreamStubProtocol.session(),
            identity: Identity(suiteName: "LiveStreamTests"), backoff: [.milliseconds(10)]
        )
        await stream.start()
        var seqs: [Int] = []
        var syncs = 0
        for await event in stream.events {
            if let seq = event.seq { seqs.append(seq) }
            if case .sync = event.body { syncs += 1 }
            if syncs == 2 { break }
        }
        await stream.stop()
        #expect(seqs == [1, 2, 3])
        let second = try #require(StreamStubProtocol.seen.dropFirst().first)
        #expect(second.value(forHTTPHeaderField: "Last-Event-ID") == "2")
        #expect(second.url?.query == "since=2")
        #expect(StreamStubProtocol.seen.first?.value(forHTTPHeaderField: "Last-Event-ID") == nil)
    }

    @Test func goesLiveOnSync() async throws {
        StreamStubProtocol.seen = []
        StreamStubProtocol.connections = [[Self.sync]]
        let stream = LiveStream(
            base: URL(string: "http://localhost:8799")!, session: StreamStubProtocol.session(),
            identity: Identity(suiteName: "LiveStreamTests"), backoff: [.seconds(60)]
        )
        await stream.start()
        for await status in stream.statuses where status == .live { break }
        await stream.stop()
        #expect(await stream.status == .offline)
    }
}
