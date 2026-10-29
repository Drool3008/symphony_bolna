// Mirrors shared/src/api.ts: HomeMedicine, HomeTest, MemberHomeResponse.

/// `HomeMedicine`.
struct HomeMedicine: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let strength: String
    let purpose: String
    let schedule: String
    let mustNotMiss: Bool
    let stock: Double
    /// "pills" or "doses".
    let unit: String
    /// The day the stock was counted.
    let stockAsOf: String
    let daysOfCover: Int
    let runsOutOn: String

    enum CodingKeys: String, CodingKey {
        case id, name, strength, purpose, schedule, stock, unit
        case mustNotMiss = "must_not_miss"
        case stockAsOf = "stock_as_of"
        case daysOfCover = "days_of_cover"
        case runsOutOn = "runs_out_on"
    }
}

/// `HomeTest`. An overdue test has a negative `daysUntilDue`.
struct HomeTest: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let everyDays: Int
    let lastDone: String
    let nextDue: String
    let daysUntilDue: Int
    let overdue: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, overdue
        case everyDays = "every_days"
        case lastDone = "last_done"
        case nextDue = "next_due"
        case daysUntilDue = "days_until_due"
    }
}

/// `MemberHomeResponse`: GET /api/members/:id/home.
struct MemberHomeResponse: Codable, Sendable, Equatable {
    let member: MemberSummary
    /// The sim clock the figures were computed against.
    let clock: String
    let today: String
    /// How much the asking member may see. Status only leaves both lists empty.
    let shared: ShareLevel
    let medicines: [HomeMedicine]
    let tests: [HomeTest]
    /// The agent's most recent message to this member. Always null at backend 78d9dee.
    let latestAgentWord: String?

    enum CodingKeys: String, CodingKey {
        case member, clock, today, shared, medicines, tests
        case latestAgentWord = "latest_agent_word"
    }
}
