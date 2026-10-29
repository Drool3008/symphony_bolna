import Foundation
import Observation

/// A store that holds what a screen shows, filled by REST reads and the
/// stream. One per area: home, the agent thread, the chats (brief, Section 4).
@MainActor
protocol RunScopedStore: AnyObject {
    /// Forget everything: the run it came from is over.
    func clear()
    /// Read again what is on screen.
    func refetch() async
}

/// What the stream says is true now: the sim clock, the stage, which run.
@MainActor
@Observable
final class SessionStore {
    /// Sim time. The only "today" the app shows; the device's date is never used.
    var clock: String?
    var stage = 1
    var generation: Int?
    /// Connecting until the stream says otherwise, so a launch does not flash "offline".
    var connection: LiveStream.Status = .connecting
}

/// Feeds the stream into the stores, so every screen moves when the server does.
///
/// A reset means a new run (server/src/reset.ts): every store is cleared and
/// what is on screen is read again, so nothing from the last run stays
/// visible. The same happens when `sync` reports a generation other than the
/// one the stores were filled in, which is how a phone that was away during a
/// reset finds out.
@MainActor
@Observable
final class AppModel {
    let session = SessionStore()
    @ObservationIgnored let stream: LiveStream
    @ObservationIgnored private(set) var stores: [any RunScopedStore] = []
    @ObservationIgnored private var listening: Task<Void, Never>?
    @ObservationIgnored private var watchingStatus: Task<Void, Never>?

    init(stream: LiveStream = LiveStream()) {
        self.stream = stream
    }

    func register(_ store: any RunScopedStore) {
        stores.append(store)
    }

    func connect() {
        guard listening == nil else { return }
        let stream = stream
        listening = Task { @MainActor [weak self] in
            await stream.start()
            for await event in stream.events { self?.apply(event) }
        }
        watchingStatus = Task { @MainActor [weak self] in
            for await status in stream.statuses { self?.session.connection = status }
        }
    }

    /// The app came back to the foreground: reconnect now rather than after a backoff.
    func returnedToForeground() {
        let stream = stream
        Task { await stream.reconnectNow() }
    }

    func apply(_ event: StreamEvent) {
        switch event.body {
        case let .sync(sync):
            let known = session.generation
            session.clock = event.clock
            session.stage = sync.stage
            session.generation = sync.generation
            if let known, known != sync.generation { newRun() }
        case .reset:
            session.clock = event.clock
            session.stage = 1
            session.generation = (session.generation ?? 0) + 1
            newRun()
        case .clock:
            session.clock = event.clock
        case let .stage(change):
            session.stage = change.stage
        default:
            break
        }
    }

    private func newRun() {
        for store in stores { store.clear() }
        let stores = stores
        Task {
            for store in stores { await store.refetch() }
        }
    }
}
