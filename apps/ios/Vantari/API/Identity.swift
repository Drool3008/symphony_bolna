import Foundation

/// Who is asking, in one place (brief, Section 4; HANDOFF.md section 7).
///
/// In this pass the member picks who they are and every request names them in
/// X-Member-Id, which the server checks against onboarding
/// (server/src/auth.ts, actor()). That identifies a member; it proves nothing,
/// so the picker is labelled as a development identity. Real sign-in replaces
/// the inside of this type and no screen changes.
///
/// Only the chosen member id is kept on disk, in UserDefaults, never health data.
struct Identity: Sendable {
    /// Where the choice is kept. Never the launch argument's key: UserDefaults'
    /// argument domain outranks anything the app sets, so a pick made on the
    /// picker under `-member-id ""` would never reach a request.
    static let storageKey = "chosen-member"
    /// The launch argument that sets the starting state: `-member-id rp`, or `-member-id ""` for none.
    static let launchKey = "member-id"

    /// The defaults suite to keep the choice in; tests pass their own.
    let suiteName: String?

    init(suiteName: String? = nil) {
        self.suiteName = suiteName
    }

    private var defaults: UserDefaults {
        suiteName.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    }

    /// Takes a `-member-id` launch argument, if there is one, as the choice. Run once at launch.
    func takeLaunchArgument(
        _ arguments: [String: Any] = UserDefaults.standard.volatileDomain(forName: UserDefaults.argumentDomain)
    ) {
        guard let id = arguments[Self.launchKey] as? String else { return }
        if id.isEmpty { forget() } else { choose(id) }
    }

    /// The member this phone belongs to, or nil before anyone has been picked.
    var memberId: String? {
        defaults.string(forKey: Self.storageKey).flatMap { $0.isEmpty ? nil : $0 }
    }

    func choose(_ id: String) {
        defaults.set(id, forKey: Self.storageKey)
    }

    func forget() {
        defaults.removeObject(forKey: Self.storageKey)
    }

    /// The headers that tie a request to a person. The only reader of the chosen id for requests.
    var headers: [String: String] {
        memberId.map { ["X-Member-Id": $0] } ?? [:]
    }
}
