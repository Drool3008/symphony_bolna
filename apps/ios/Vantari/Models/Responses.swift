// Bodies the server sends that shared/ does not type yet, read off
// server/src/app.ts and server/src/http.ts. Replace them when shared/ exports
// them (docs/backend-asks.md).

/// POST /api/input's body (server/src/app.ts, InputBody).
struct InputRequest: Codable, Sendable, Equatable {
    let text: String
    /// Picks the stub's script only; the model never sees it.
    var sampleId: String?

    enum CodingKeys: String, CodingKey {
        case text
        case sampleId = "sample_id"
    }
}

/// POST /api/input. `as` says whether the line ended a wait or started something new.
struct InputResponse: Codable, Sendable, Equatable {
    enum Routed: String, Codable, Sendable {
        case reply, input
    }

    let ok: Bool
    let routed: Routed

    enum CodingKeys: String, CodingKey {
        case ok
        case routed = "as"
    }
}

/// POST /api/reply. `delivered` is false when the agent was not waiting on this person.
struct ReplyResponse: Codable, Sendable, Equatable {
    let ok: Bool
    let delivered: Bool
}

/// POST /api/forward.
struct ForwardResponse: Codable, Sendable, Equatable {
    let ok: Bool
}

/// Every refusal (server/src/http.ts, errorHandler): plain words for a person.
struct ErrorBody: Codable, Sendable, Equatable {
    let error: String
}
