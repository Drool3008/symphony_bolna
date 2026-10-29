import Foundation

/// One event from GET /events (server/src/events.ts).
///
/// REPLACE THE PAYLOAD TYPES BELOW when shared/src/events.ts types the full
/// set: today it names 7 of the types and none of their payloads (backend
/// ask). Each payload is read off the code that emits it, named in its comment.
///
/// On the wire every logged event is one JSON object: `seq`, `type`, `at`
/// (wall time), `clock` (sim time) and its payload's fields at the top level.
/// A payload field named `seq`, `type`, `at` or `clock` is overwritten by the
/// envelope's (server/src/store/event-log.ts). `sync` is sent to one client
/// on connect, is not logged, and has no `seq`.
struct StreamEvent: Decodable, Sendable {
    let seq: Int?
    let type: String
    /// Wall time.
    let at: String
    /// Sim time. The time to show for anything the event records.
    let clock: String?
    let body: Body

    enum Body: Sendable {
        case sync(Sync)
        case reset(Reset)
        case error(Failure)
        case clock(ClockMoved)
        case stage(StageChanged)
        case input(Input)
        case message(Message)
        case chatMessage(ChatLine)
        case cardAnswered(CardAnswered)
        case cardTimedOut(CardTimedOut)
        case awaitingReply(AwaitingReply)
        case replySettled(ReplySettled)
        case noAnswer(NoAnswer)
        case decision(DecisionLogged)
        case thinking(Thinking)
        case modelStep(ModelStep)
        case toolCall(ToolCall)
        case toolResult(ToolResult)
        case toolRejected(ToolRejected)
        case idle(Idle)
        case operatorPending(OperatorPending)
        case operatorResolved(OperatorResolved)
        case recordUpdate(RecordUpdate)
        case scenarioSelected(ScenarioSelected)
        /// A type this build does not know. Ignored, never a crash.
        case unknown
    }

    private enum EnvelopeKeys: String, CodingKey {
        case seq, type, at, clock
    }

    init(from decoder: Decoder) throws {
        let envelope = try decoder.container(keyedBy: EnvelopeKeys.self)
        seq = try envelope.decodeIfPresent(Int.self, forKey: .seq)
        type = try envelope.decode(String.self, forKey: .type)
        at = try envelope.decode(String.self, forKey: .at)
        clock = try envelope.decodeIfPresent(String.self, forKey: .clock)
        func payload<T: Decodable>(_: T.Type) throws -> T { try T(from: decoder) }
        switch type {
        case "sync": body = .sync(try payload(Sync.self))
        case "reset": body = .reset(try payload(Reset.self))
        case "error": body = .error(try payload(Failure.self))
        case "clock": body = .clock(try payload(ClockMoved.self))
        case "stage": body = .stage(try payload(StageChanged.self))
        case "input": body = .input(try payload(Input.self))
        case "message": body = .message(try payload(Message.self))
        case "chat_message": body = .chatMessage(try payload(ChatLine.self))
        case "card_answered": body = .cardAnswered(try payload(CardAnswered.self))
        case "card_timed_out": body = .cardTimedOut(try payload(CardTimedOut.self))
        case "awaiting_reply": body = .awaitingReply(try payload(AwaitingReply.self))
        case "reply_settled": body = .replySettled(try payload(ReplySettled.self))
        case "no_answer": body = .noAnswer(try payload(NoAnswer.self))
        case "decision": body = .decision(try payload(DecisionLogged.self))
        case "thinking": body = .thinking(try payload(Thinking.self))
        case "model_step": body = .modelStep(try payload(ModelStep.self))
        case "tool_call": body = .toolCall(try payload(ToolCall.self))
        case "tool_result": body = .toolResult(try payload(ToolResult.self))
        case "tool_rejected": body = .toolRejected(try payload(ToolRejected.self))
        case "idle": body = .idle(try payload(Idle.self))
        case "operator_pending": body = .operatorPending(try payload(OperatorPending.self))
        case "operator_resolved": body = .operatorResolved(try payload(OperatorResolved.self))
        case "record_update": body = .recordUpdate(try payload(RecordUpdate.self))
        case "scenario_selected": body = .scenarioSelected(try payload(ScenarioSelected.self))
        default: body = .unknown
        }
    }
}

extension StreamEvent {
    /// A wait the agent has open on a person (server/src/domain/waits.ts, OpenWait).
    struct OpenWait: Decodable, Sendable, Equatable {
        let id: String
        let member: String
        let whatFor: String
        let deadline: String
        enum CodingKeys: String, CodingKey { case id, member, deadline; case whatFor = "what_for" }
    }

    /// What is true now, once per connection (server/src/events.ts, runtime.ts
    /// syncState, and the parts waits.ts, operator.ts and agent/loop.ts provide).
    struct Sync: Decodable, Sendable {
        let stage: Int
        let generation: Int
        let waits: [OpenWait]?
        let operatorPending: Int?
        let running: Bool?
        let model: String?
        enum CodingKeys: String, CodingKey {
            case stage, generation, waits, running, model
            case operatorPending = "operator_pending"
        }
    }

    /// server/src/reset.ts
    struct Reset: Decodable, Sendable { let reason: String }
    /// server/src/agent/loop.ts
    struct Failure: Decodable, Sendable { let error: String }
    /// server/src/clock.ts. The new sim time is the envelope's `clock`.
    struct ClockMoved: Decodable, Sendable { let source: String; let reached: [AgentDate] }
    /// server/src/agent/tools.ts, set_stage
    struct StageChanged: Decodable, Sendable { let stage: Int; let why: String }

    /// server/src/agent/inbox.ts: what the model was given, with its source (R2).
    struct Input: Decodable, Sendable {
        let input: [String: JSONValue]
        let attachment: JSONValue?
        var kind: String? { input["kind"]?.string }
        var source: String? { input["source"]?.string }
        var from: String? { input["from"]?.string }
    }

    /// server/src/store/conversations.ts, AgentThreads.post
    struct Message: Decodable, Sendable { let message: ThreadMessage }
    /// server/src/store/conversations.ts, FamilyChats.post
    struct ChatLine: Decodable, Sendable { let key: String; let message: ChatMessage }

    /// server/src/store/conversations.ts, answerCard. Its own sim-time `at` is
    /// lost under the envelope's wall time; the answer's sim time is `clock`.
    struct CardAnswered: Decodable, Sendable {
        let messageId: String
        let answer: String
        enum CodingKeys: String, CodingKey { case answer; case messageId = "message_id" }
    }

    /// server/src/domain/waits.ts
    struct CardTimedOut: Decodable, Sendable {
        let messageId: String
        let reason: String
        enum CodingKeys: String, CodingKey { case reason; case messageId = "message_id" }
    }

    /// server/src/domain/waits.ts
    struct AwaitingReply: Decodable, Sendable {
        let id: String
        let from: String
        let whatFor: String
        let waitSeconds: Int
        let deadline: String
        enum CodingKeys: String, CodingKey {
            case id, from, deadline
            case whatFor = "what_for"
            case waitSeconds = "wait_seconds"
        }
    }

    /// How a wait ended (server/src/domain/waits.ts, WaitResult). `text` and
    /// `action` come with an answer; `reason` without one.
    struct WaitResult: Decodable, Sendable {
        let answered: Bool
        let from: String
        let text: String?
        let action: String?
        let reason: String?
        let at: String
    }

    /// server/src/domain/waits.ts
    struct ReplySettled: Decodable, Sendable { let id: String; let from: String; let result: WaitResult }
    /// server/src/app.ts, POST /api/no-answer
    struct NoAnswer: Decodable, Sendable { let from: String; let source: String }
    /// server/src/store/decisions.ts
    struct DecisionLogged: Decodable, Sendable { let decision: Decision }
    /// server/src/agent/loop.ts
    struct Thinking: Decodable, Sendable { let step: Int }

    /// server/src/agent/loop.ts
    struct ModelStep: Decodable, Sendable {
        struct Call: Decodable, Sendable { let id: String; let name: String; let args: JSONValue? }
        let step: Int
        let text: String?
        let toolCalls: [Call]
        enum CodingKeys: String, CodingKey { case step, text; case toolCalls = "tool_calls" }
    }

    /// server/src/agent/loop.ts
    struct ToolCall: Decodable, Sendable { let id: String; let name: String; let args: JSONValue?; let mode: String? }
    /// server/src/agent/loop.ts
    struct ToolResult: Decodable, Sendable { let id: String; let name: String; let result: JSONValue? }
    /// server/src/agent/loop.ts
    struct ToolRejected: Decodable, Sendable {
        let id: String
        let name: String
        let reason: String
        let result: JSONValue?
    }

    /// server/src/agent/loop.ts
    struct Idle: Decodable, Sendable { let reason: String }

    /// A call waiting on a person or a fixture (server/src/agent/operator.ts, QueueItem).
    struct QueueItem: Decodable, Sendable {
        let id: String
        let callId: String
        let tool: String
        let mode: String
        let request: [String: JSONValue]
        let fixtures: [String: JSONValue]
        let state: String
        let response: JSONValue?
        let variant: String?
        let via: String?
        let createdAt: String
        let resolvedAt: String?
        enum CodingKeys: String, CodingKey {
            case id, tool, mode, request, fixtures, state, response, variant, via
            case callId = "call_id"
            case createdAt = "created_at"
            case resolvedAt = "resolved_at"
        }
    }

    /// server/src/agent/operator.ts
    struct OperatorPending: Decodable, Sendable { let item: QueueItem }
    /// server/src/agent/operator.ts
    struct OperatorResolved: Decodable, Sendable {
        let id: String
        let response: JSONValue?
        let variant: String?
        let via: String
    }

    /// server/src/agent/tools.ts, record_update
    struct RecordUpdate: Decodable, Sendable {
        let target: String
        let id: String
        let changes: [String: JSONValue]
        let why: String
    }

    /// server/src/app.ts, POST /api/input under the stub
    struct ScenarioSelected: Decodable, Sendable {
        let sampleId: String
        let script: String
        let note: String
        enum CodingKeys: String, CodingKey { case script, note; case sampleId = "sample_id" }
    }
}
