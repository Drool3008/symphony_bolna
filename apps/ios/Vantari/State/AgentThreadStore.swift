import Foundation
import Observation

/// The agent's conversations, as the stream carries them: the one place
/// screens get a member's thread and the waits on them. The same folding as
/// the web client's src/data/agentThread.ts.
///
/// There is no read route for a thread yet (docs/backend-asks.md, ask 1), so
/// it is rebuilt from the stream: a connection replays every event of the
/// current run, then sends new ones (server/src/events.ts). When a read route
/// lands, `refetch` reads it and no screen changes.
///
/// The stream still carries every member's events (ask 2). They are kept here
/// by thread, so a member picked after the replay still finds their own; a
/// screen asks for one member's share and shows nothing else.
@MainActor
@Observable
final class AgentThreadStore: RunScopedStore {
    /// Every agent thread the stream has carried, by thread id (a member's id,
    /// `family_group`, or the doctor's).
    private(set) var threads: [String: [ThreadMessage]] = [:]
    /// The waits the agent has open (server/src/domain/waits.ts), on anyone.
    private(set) var waits: [StreamEvent.OpenWait] = []
    /// The last card the agent sent while this phone was live, after the
    /// replay: the shell opens Chat for it (the reference's `lastCard` effect).
    private(set) var arrivedCard: ThreadMessage?
    /// How many of the agent's messages each member had when they last had Chat open.
    private(set) var seen: [String: Int] = [:]
    /// A tap on a card still with the server, by message id: the label sent.
    private(set) var sending: [String: String] = [:]
    /// Why the server would not take a tap on a card, by message id.
    private(set) var refusals: [String: APIError] = [:]
    /// True once this phone has had a `sync`: what follows is live, not replay.
    @ObservationIgnored private(set) var live = false
    @ObservationIgnored private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    // MARK: One member's share

    func messages(for member: String) -> [ThreadMessage] {
        threads[member] ?? []
    }

    /// Cards in the member's thread still waiting on their answer.
    func openCards(for member: String) -> [ThreadMessage] {
        messages(for: member).filter(\.isOpenCard)
    }

    func waits(on member: String) -> [StreamEvent.OpenWait] {
        waits.filter { $0.member == member }
    }

    /// Whether anything waits on this member: an open card or an open wait.
    func waitsOnAnswer(from member: String) -> Bool {
        !openCards(for: member).isEmpty || !waits(on: member).isEmpty
    }

    /// The agent's messages this member has not seen since they last opened Chat.
    func unread(for member: String) -> Int {
        max(0, agentCount(member) - seen[member, default: 0])
    }

    /// The member has Chat open: everything the agent has said so far is seen.
    func markSeen(_ member: String) {
        let count = agentCount(member)
        if seen[member] != count { seen[member] = count }
    }

    private func agentCount(_ member: String) -> Int {
        messages(for: member).count { $0.from == "agent" }
    }

    // MARK: The stream

    func hear(_ event: StreamEvent) {
        switch event.body {
        case let .message(posted):
            let message = posted.message
            var thread = threads[message.thread] ?? []
            if let index = thread.firstIndex(where: { $0.id == message.id }) {
                thread[index] = message
            } else {
                thread.append(message)
            }
            threads[message.thread] = thread
            if live, message.from == "agent", message.card != nil { arrivedCard = message }
        case let .cardAnswered(answered):
            // The answer's sim time is the envelope's clock (backend ask 8).
            patch(answered.messageId) { m in
                m.answer = answered.answer
                m.answeredAt = event.clock
            }
            sending[answered.messageId] = nil
            refusals[answered.messageId] = nil
        case let .cardTimedOut(timedOut):
            patch(timedOut.messageId) { $0.timedOutAt = event.clock }
        case let .awaitingReply(wait):
            waits.removeAll { $0.id == wait.id }
            waits.append(StreamEvent.OpenWait(id: wait.id, member: wait.from, whatFor: wait.whatFor, deadline: wait.deadline))
        case let .replySettled(settled):
            waits.removeAll { $0.id == settled.id }
        case let .sync(sync):
            waits = sync.waits ?? []
            live = true
        default:
            break
        }
    }

    private func patch(_ id: String, _ change: (inout ThreadMessage) -> Void) {
        for (key, thread) in threads {
            guard let index = thread.firstIndex(where: { $0.id == id }) else { continue }
            var thread = thread
            change(&thread[index])
            threads[key] = thread
            return
        }
    }

    func clear() {
        threads = [:]
        waits = []
        arrivedCard = nil
        seen = [:]
        sending = [:]
        refusals = [:]
    }

    /// Nothing to read: there is no route for a thread yet, and the stream
    /// brings the new run's events as they happen.
    func refetch() async {}

    // MARK: What the member sends

    /// Answers a card with one of its labels (POST /api/reply with `message_id`
    /// and `action`). The server locks the card and the stream locks it on
    /// every phone; a refusal, such as a card already answered, keeps the
    /// server's own words.
    func answer(_ message: ThreadMessage, with label: String) async {
        guard sending[message.id] == nil else { return }
        sending[message.id] = label
        refusals[message.id] = nil
        do {
            _ = try await api.reply(ReplyRequest(action: label, messageId: message.id))
            patch(message.id) { m in
                if m.answer == nil { m.answer = label }
            }
        } catch let error as APIError {
            refusals[message.id] = error
        } catch {
            refusals[message.id] = .offline
        }
        sending[message.id] = nil
    }

    /// Something the member typed or tapped, as text (POST /api/input). The
    /// server decides whether it is their reply to a wait or a new input
    /// (server/src/app.ts); the line comes back on the stream in their thread.
    /// Returns why it was not taken, or nil.
    func say(_ text: String) async -> APIError? {
        do {
            _ = try await api.input(InputRequest(text: text))
            return nil
        } catch let error as APIError {
            return error
        } catch {
            return .offline
        }
    }
}
