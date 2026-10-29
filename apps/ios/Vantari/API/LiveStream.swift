import Foundation

/// The app's one connection to GET /events (brief, Section 4).
///
/// Read with `URLSession.bytes(for:)` and parsed byte by byte by `SSEParser`.
/// On connect the server replays this generation's events after the last one
/// this client saw, then sends `sync`. The last event id is kept and sent as
/// Last-Event-ID on every reconnect, so a drop loses nothing. After a drop it
/// waits longer each time (the delays in `backoff`, the last repeating) until
/// a connection reaches `sync`. Returning to the foreground reconnects at once.
actor LiveStream {
    enum Status: Sendable, Equatable {
        case connecting, live, offline
    }

    nonisolated let events: AsyncStream<StreamEvent>
    nonisolated let statuses: AsyncStream<Status>
    private let eventSink: AsyncStream<StreamEvent>.Continuation
    private let statusSink: AsyncStream<Status>.Continuation

    private let base: URL
    private let session: URLSession
    private let identity: Identity
    private let backoff: [Duration]
    private let decoder = JSONDecoder()
    private var task: Task<Void, Never>?
    private var tries = 0
    private(set) var status: Status = .offline
    /// The seq of the last logged event this client has seen.
    private(set) var lastEventId: Int?

    init(
        base: URL = Backend.base,
        session: URLSession = .shared,
        identity: Identity = Identity(),
        backoff: [Duration] = [.milliseconds(500), .seconds(1), .seconds(2), .seconds(5), .seconds(10), .seconds(30)]
    ) {
        self.base = base
        self.session = session
        self.identity = identity
        self.backoff = backoff.isEmpty ? [.seconds(1)] : backoff
        (events, eventSink) = AsyncStream.makeStream(of: StreamEvent.self)
        (statuses, statusSink) = AsyncStream.makeStream(of: Status.self)
    }

    func start() {
        guard task == nil else { return }
        task = Task { await self.run() }
    }

    func stop() {
        task?.cancel()
        task = nil
        set(.offline)
    }

    /// Drop the connection, if any, and connect again now, without waiting out a backoff.
    func reconnectNow() {
        task?.cancel()
        task = nil
        tries = 0
        start()
    }

    /// Forget the position, for a new run: the next connection replays the whole generation.
    func forgetPosition() {
        lastEventId = nil
    }

    private func set(_ new: Status) {
        guard new != status else { return }
        status = new
        statusSink.yield(new)
    }

    private func run() async {
        while !Task.isCancelled {
            await connectOnce()
            if Task.isCancelled { return }
            set(.offline)
            let delay = backoff[min(tries, backoff.count - 1)]
            tries += 1
            try? await Task.sleep(for: delay)
        }
    }

    private func connectOnce() async {
        set(.connecting)
        var url = base.appending(path: "events")
        var request = URLRequest(url: url)
        if let lastEventId {
            url.append(queryItems: [URLQueryItem(name: "since", value: String(lastEventId))])
            request = URLRequest(url: url)
            request.setValue(String(lastEventId), forHTTPHeaderField: "Last-Event-ID")
        }
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = .infinity
        // /events reads no header today (server/src/events.ts); sent so a per-member stream needs no change here.
        for (name, value) in identity.headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return }
            var parser = SSEParser()
            for try await byte in bytes {
                for frame in parser.feed(CollectionOfOne(byte)) {
                    deliver(frame)
                }
            }
        } catch {
            // A drop, a refusal or a cancel; run() decides what follows.
        }
    }

    private func deliver(_ frame: SSEFrame) {
        if let id = frame.id.flatMap(Int.init) { lastEventId = id }
        guard let event = try? decoder.decode(StreamEvent.self, from: Data(frame.data.utf8)) else { return }
        if case .unknown = event.body { return }
        if case .sync = event.body {
            // The replay is over and the connection is live: a later drop starts the backoff again.
            tries = 0
            set(.live)
        }
        eventSink.yield(event)
    }
}
