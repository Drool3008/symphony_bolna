import Foundation
import Observation

/// The family from GET /api/members, and which member this phone belongs to.
@MainActor
@Observable
final class FamilyStore: RunScopedStore {
    private(set) var members: [MemberSummary] = []
    private(set) var problem: String?
    private(set) var memberId: String?
    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let identity: Identity

    init(api: APIClient = APIClient(), identity: Identity = Identity()) {
        self.api = api
        self.identity = identity
        memberId = identity.memberId
    }

    /// The member this phone belongs to, once the family has loaded.
    var me: MemberSummary? { members.first { $0.id == memberId } }

    func load() async {
        do {
            members = try await api.members().members
            problem = nil
            // A member the server no longer knows goes back to the picker.
            if let memberId, !members.contains(where: { $0.id == memberId }) { forget() }
        } catch let error as APIError {
            problem = error.message
        } catch {
            problem = APIError.offline.message
        }
    }

    func choose(_ id: String) {
        identity.choose(id)
        memberId = id
    }

    func forget() {
        identity.forget()
        memberId = nil
    }

    func clear() {}

    func refetch() async { await load() }
}
