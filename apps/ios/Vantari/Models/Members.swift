// Mirrors shared/src/api.ts: MemberSummary, MembersResponse, and Role and
// ShareLevel from shared/src/onboarding.ts.

/// `Role` in shared/src/onboarding.ts.
enum Role: String, Codable, Sendable {
    case patient
    case responsiblePerson = "responsible_person"
    case family
}

/// `ShareLevel` in shared/src/onboarding.ts.
enum ShareLevel: String, Codable, Sendable {
    case full
    case statusOnly = "status_only"
}

/// `MemberSummary`.
struct MemberSummary: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let role: Role
    /// A BCP-47 code, such as te-IN.
    let language: String
}

/// `MembersResponse`: GET /api/members.
struct MembersResponse: Codable, Sendable, Equatable {
    let members: [MemberSummary]
}
