// What a card on a ThreadMessage is and how it reads. The card itself is the
// agent's free-form object (server/src/agent/tools.ts, send_message; shared/
// types it `Record<string, unknown>`), so everything here reads it defensively.

/// Where a card stands, which sets how it looks (the reference's DecisionCard
/// in src/components/AgentChat.tsx): amber while it waits on a person, green
/// once they said yes, grey for any other answer or for no answer in time,
/// and the agent's violet for a record of something already done.
enum CardState: Equatable, Sendable {
    case open
    case yes
    case other
    case timedOut
    case record
}

extension ThreadMessage {
    var cardKind: String? { card?["kind"]?.string }

    /// A card that reports what was already done and can never be answered.
    var isRecordCard: Bool { CardLabels.records.contains(cardKind ?? "") }

    /// A card still waiting on its person: not answered, not timed out, not a record.
    var isOpenCard: Bool { card != nil && !isRecordCard && answer == nil && timedOutAt == nil }

    var cardState: CardState? {
        guard card != nil else { return nil }
        if isRecordCard { return .record }
        if let answer { return CardLabels.isYes(answer) ? .yes : .other }
        if timedOutAt != nil { return .timedOut }
        return .open
    }

    /// A string field of the card, when it is there and not empty.
    func cardText(_ key: String) -> String? {
        guard let text = card?[key]?.string, !text.isEmpty else { return nil }
        return text
    }

    func cardNumber(_ key: String) -> Double? { card?[key]?.number }
}

/// TEMPORARY FALLBACK for what a card does not say itself. Remove the titles
/// and buttons when the server sends every card's own (backend ask 4).
///
/// Rewritten from the reference client's src/components/AgentChat.tsx
/// (TITLES, DEFAULT_BUTTONS, YES, PAST and RECORDS), as the web client's
/// src/components/cardLabels.ts does, so a card that names no buttons can
/// still be answered. The label pressed is the answer the agent reads, which
/// is why the labels stay in English, as the agent wrote the card.
enum CardLabels {
    static let titles: [String: String] = [
        "spend_above_threshold": "Spend needs your OK",
        "new_doctor": "A doctor you have not used before",
        "new_medicine": "A medicine not on the list",
        "disagreement": "You and the patient disagree",
        "cant_tell": "I cannot tell how serious this is",
        "low_wallet": "Wallet running low",
        "dead_end": "I hit a dead end",
        "substitute_offered": "A chemist offered a substitute",
        "incident_summary": "What happened",
        "test_due": "A check-up is due",
        "slot_unavailable": "That doctor has nothing free",
        "care_quote": "Approve the visit and the cab",
        "order_receipt": "Paid and recorded",
    ]

    static let buttons: [String: [String]] = [
        "spend_above_threshold": ["Approve", "Hold unpaid"],
        "new_doctor": ["Approve", "Choose another", "Call me"],
        "new_medicine": ["Approve", "Choose another", "Call me"],
        "disagreement": ["Act", "Don't act"],
        "cant_tell": ["Treat as urgent", "It's fine", "Call me"],
        "low_wallet": ["Top up", "Later"],
        "dead_end": ["OK", "Try something else"],
        "substitute_offered": ["Ask the doctor", "Decline"],
        "incident_summary": [],
        "payment": ["Approve", "Hold unpaid"],
        "booking": ["Yes", "No"],
        "test_due": ["Yes, book it", "Not now"],
        "slot_unavailable": ["Another doctor", "Another date", "Don't book"],
        "care_quote": ["Go ahead", "Not now"],
    ]

    /// Card kinds that report something already done: never a button.
    static let records: Set<String> = ["order_receipt"]

    /// Answers that say yes; anything else is a no, a hold or a defer.
    static let yesWords: Set<String> = [
        "approve", "yes", "act", "treat as urgent", "top up", "ok", "ask the doctor", "yes, book it", "go ahead",
    ]

    /// How an answered card's band says the answer, in the past tense.
    static let past: [String: String] = [
        "approve": "Approved", "yes": "Confirmed", "no": "Declined", "hold": "Held", "hold unpaid": "Held unpaid",
        "decline": "Declined", "act": "Go ahead", "don't act": "Do not act", "later": "Later",
        "yes, book it": "Booking it", "not now": "Not now",
    ]

    static func isYes(_ answer: String) -> Bool { yesWords.contains(answer.lowercased()) }

    static func pastTense(_ answer: String) -> String { past[answer.lowercased()] ?? answer }

    /// The card's own title, else the fallback for its kind.
    static func title(_ message: ThreadMessage) -> String? {
        message.cardText("title") ?? message.cardKind.flatMap { titles[$0] }
    }

    /// The card's own buttons when it names them, else the fallback for its
    /// kind. A record has none, whatever arrives.
    static func buttons(_ message: ThreadMessage) -> [String] {
        guard !message.isRecordCard else { return [] }
        if case let .array(own)? = message.card?["buttons"] {
            let labels = own.compactMap(\.string)
            if labels.count == own.count { return labels }
        }
        return message.cardKind.flatMap { buttons[$0] } ?? []
    }

    /// The facts a person checks before saying yes, in the reference's order
    /// (AgentChat.tsx, FACTS): the card's field and the label it goes under.
    static let facts: [(key: String, label: StringKey)] = [
        ("medicine", .factMedicine), ("strength", .factStrength), ("quantity", .factQuantity),
        ("test", .factTest), ("doctor", .factDoctor), ("clinic", .factClinic), ("when", .factWhen),
        ("for", .factFor), ("payee", .factPayee),
    ]
}
