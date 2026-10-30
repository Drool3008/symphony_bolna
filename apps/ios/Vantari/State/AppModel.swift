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
    /// One event from the stream, after AppModel has taken what it keeps.
    func hear(_ event: StreamEvent)
}

extension RunScopedStore {
    func hear(_ event: StreamEvent) {}
}

/// What the stream says is true now: the sim clock, the stage, which run.
@MainActor
@Observable
final class SessionStore {
    /// Sim time. The only "today" the app shows; the device's date is never used.
    var clock: String?
    var stage = 1
    var generation: Int?
    /// The agent is working: from a `thinking` event until `idle` (server/src/agent/loop.ts).
    var thinking = false
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
    /// A fresh replay of the whole run was asked for and has not reached its sync.
    @ObservationIgnored private var replayingFromStart = false

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
            // Sent after the replay, so it overrides whatever the replay's thinking events said.
            if let running = sync.running { session.thinking = running }
            replayingFromStart = false
            if let known, known != sync.generation {
                newRun()
                replayFromStart()
            }
        case .reset:
            session.clock = event.clock
            // A connection's replay opens with the reset that began the current
            // run. Before the first sync there is no older run on screen, and
            // clearing would wipe the thread the replay is about to rebuild (the
            // web client's src/api/live.ts does the same). The same holds for a
            // replay asked for after a new run was found (`replayFromStart`).
            if session.generation == nil || replayingFromStart {
                replayingFromStart = false
                break
            }
            session.stage = 1
            session.thinking = false
            session.generation = (session.generation ?? 0) + 1
            newRun()
        case .clock:
            session.clock = event.clock
        case let .stage(change):
            session.stage = change.stage
        case .thinking:
            session.thinking = true
        case .idle, .error:
            // A run ends with `idle`, or with `error` when the model call fails or
            // runs out of steps (server/src/agent/loop.ts). A run cut short by a
            // reset sends neither; the reset itself clears it.
            session.thinking = false
        default:
            break
        }
        for store in stores { store.hear(event) }
    }

    /// A phone that was away during resets learns of the new run only from
    /// `sync`, which comes after the replay; clearing for the new run then
    /// throws away the new run's events the replay just brought. Home reads
    /// itself again, but the thread exists only in the stream, so the whole
    /// run is asked for again from its start.
    private func replayFromStart() {
        guard listening != nil else { return }
        replayingFromStart = true
        let stream = stream
        Task {
            await stream.forgetPosition()
            await stream.reconnectNow()
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
