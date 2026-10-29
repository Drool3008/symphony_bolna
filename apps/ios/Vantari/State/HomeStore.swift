import Foundation
import Observation

/// Members' homes as the asking member may see them (GET /api/members/:id/home),
/// as the web client's src/data/home.ts. The server computes days of cover and
/// due dates against the sim clock and filters by consent; this store only
/// holds what it sent and reads it again when the stream says it has changed.
@MainActor
@Observable
final class HomeStore: RunScopedStore {
    private(set) var homes: [String: MemberHomeResponse] = [:]
    /// Why the last read of a member's home failed: the server's refusal, or offline.
    private(set) var problems: [String: APIError] = [:]
    @ObservationIgnored private let api: APIClient
    /// The members whose homes are on screen, in order.
    @ObservationIgnored private var shown: [String] = []
    @ObservationIgnored private var stale: Set<String> = []
    @ObservationIgnored private var reading: Task<Void, Never>?

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    /// Show these members' homes, the asking member's first, and read them now.
    func show(_ ids: [String]) async {
        shown = ids
        await read(ids)
    }

    /// Pull to refresh: read every home on screen again.
    func reload() async {
        await read(shown)
    }

    func clear() {
        homes = [:]
        problems = [:]
        stale = []
    }

    func refetch() async {
        await reload()
    }

    func hear(_ event: StreamEvent) {
        switch event.body {
        case .clock:
            // Days of cover and due dates count down on the server's clock.
            markStale(shown)
        default:
            break
        }
    }

    /// Reads these homes again soon. A replay brings many events at once; they
    /// are gathered into one read per home rather than one per event.
    func markStale(_ ids: [String]) {
        stale.formUnion(ids.filter(shown.contains))
        guard reading == nil, !stale.isEmpty else { return }
        reading = Task { [weak self] in
            await Task.yield()
            guard let self else { return }
            let ids = shown.filter(stale.contains)
            stale = []
            reading = nil
            await read(ids)
        }
    }

    private func read(_ ids: [String]) async {
        for id in ids {
            do {
                homes[id] = try await api.home(id)
                problems[id] = nil
            } catch let error as APIError {
                problems[id] = error
            } catch {
                problems[id] = .offline
            }
        }
    }
}
