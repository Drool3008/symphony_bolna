// Mirrors shared/src/api.ts: ThreadMessage, ChatMessage, ChatSendRequest,
// ChatSendResponse, ForwardRequest, ReplyRequest, Decision, AgentDate.

/// `ThreadMessage`: one message in the agent's conversation with a person,
/// the family group or the doctor. `at` is sim time.
struct ThreadMessage: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let thread: String
    let from: String
    let to: String
    let text: String
    let language: String?
    let kind: String?
    /// The card's fields as the agent wrote them (server/src/agent/tools.ts).
    let card: [String: JSONValue]?
    var answer: String?
    var answeredAt: String?
    var timedOutAt: String?
    let at: String

    enum CodingKeys: String, CodingKey {
        case id, thread, from, to, text, language, kind, card, answer, at
        case answeredAt = "answered_at"
        case timedOutAt = "timed_out_at"
    }
}

/// `ChatMessage`: one line in a family chat. The agent never reads these.
struct ChatMessage: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let key: String
    let from: String
    let text: String
    /// Addressed to the agent with @agent in the family group.
    let toAgent: Bool
    let at: String

    enum CodingKeys: String, CodingKey {
        case id, key, from, text, at
        case toAgent = "to_agent"
    }
}

/// `ChatSendRequest`: POST /api/chat/send.
struct ChatSendRequest: Codable, Sendable, Equatable {
    let chatId: String
    let text: String
    var askAgent: Bool?

    enum CodingKeys: String, CodingKey {
        case text
        case chatId = "chat_id"
        case askAgent = "ask_agent"
    }
}

/// `ChatSendResponse`.
struct ChatSendResponse: Codable, Sendable, Equatable {
    let key: String
    let message: ChatMessage
}

/// `ForwardRequest`: POST /api/forward.
struct ForwardRequest: Codable, Sendable, Equatable {
    let chatId: String
    let messageId: String
    var caption: String?
    var note: String?

    enum CodingKeys: String, CodingKey {
        case caption, note
        case chatId = "chat_id"
        case messageId = "message_id"
    }
}

/// `ReplyRequest`: POST /api/reply. One of `text` or `action` is required.
struct ReplyRequest: Codable, Sendable, Equatable {
    var text: String?
    var action: String?
    var messageId: String?

    enum CodingKeys: String, CodingKey {
        case text, action
        case messageId = "message_id"
    }
}

/// `Decision`: one row of the decision log.
struct Decision: Codable, Sendable, Equatable {
    let seq: Int
    /// Sim time.
    let when: String
    /// Wall time.
    let loggedAt: String
    let received: String
    let source: String
    let decided: String
    let ruleId: String
    let why: String
    let action: String
    let recipient: String
    let connector: String

    enum CodingKeys: String, CodingKey {
        case seq, when, received, source, decided, why, action, recipient, connector
        case loggedAt = "logged_at"
        case ruleId = "rule_id"
    }
}

/// `AgentDate`: a medicine running out or a test falling due.
struct AgentDate: Codable, Sendable, Equatable {
    /// "medicine_runs_out" or "test_due".
    let kind: String
    let id: String
    let member: String
    let date: String
}
