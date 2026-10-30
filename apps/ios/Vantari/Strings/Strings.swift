import Foundation

/// A key in Strings/Localizable.xcstrings. The same keys and wording as the
/// web client's src/i18n/strings.ts, so the two read as one product.
enum StringKey: String, CaseIterable, Sendable {
    case tabHome = "tab_home"
    case tabAgent = "tab_agent"
    case tabFamily = "tab_family"
    case tabWallet = "tab_wallet"
    case medicines = "medicines"
    case tests = "tests"
    case latest = "latest"
    case nothingOnFile = "nothing_on_file"
    case mustNotMiss = "must_not_miss"
    case daysLeftLabel = "days_left_label"
    case runsOut = "runs_out"
    case lastDone = "last_done"
    case nextDue = "next_due"
    case overdue = "overdue"
    case everyNDays = "every_n_days"
    case whose = "whose"
    case stockLeft = "stock_left"
    case stockCounted = "stock_counted"
    case message = "message"
    case send = "send"
    case noMessages = "no_messages"
    case needsAnswer = "needs_answer"
    case working = "working"
    case agent = "agent"
    case you = "you"
    case ifNoAnswer = "if_no_answer"
    case answeredBy = "answered_by"
    case timedOut = "timed_out"
    case agentGoesOn = "agent_goes_on"
    case offline = "offline"
    case familyWaiting = "family_waiting"
    case cardAmount = "card_amount"
    case cardTo = "card_to"
    case cardFor = "card_for"
    case cardWhat = "card_what"
    case cardWalletAfter = "card_wallet_after"
    case sending = "sending"
    case unitPills = "unit_pills"
    case unitDoses = "unit_doses"
    case here = "here"
    case stage0 = "stage.0"
    case stage1 = "stage.1"
    case stage2 = "stage.2"
    case stage3 = "stage.3"
    case stage4 = "stage.4"
    case stage5 = "stage.5"
    case stage6 = "stage.6"
    case stage7 = "stage.7"
    case stage8 = "stage.8"
    case stage9 = "stage.9"
    case unread = "unread"
    case yourDecision = "your_decision"
    case done = "done"
    case noAnswer = "no_answer"
    case youChose = "you_chose"
    case youChoseAt = "you_chose_at"
    case noAnswerThen = "no_answer_then"
    case why = "why"
    case walletAfterThis = "wallet_after_this"
    case receiptNo = "receipt_no"
    case total = "total"
    case factMedicine = "fact_medicine"
    case factStrength = "fact_strength"
    case factQuantity = "fact_quantity"
    case factTest = "fact_test"
    case factDoctor = "fact_doctor"
    case factClinic = "fact_clinic"
    case factWhen = "fact_when"
    case factFor = "fact_for"
    case factPayee = "fact_payee"
    case humanTag = "human_tag"
    case decisionsWaitingOne = "decisions_waiting_one"
    case decisionsWaiting = "decisions_waiting"
    case waitingOnYou = "waiting_on_you"
    case daysLeft = "days_left"
    case bookIt = "book_it"
    case tapToRefill = "tap_to_refill"

    /// What the agent is doing at a stage it set (0 to 9, server/src/agent/tools.ts, set_stage).
    static func stage(_ n: Int) -> StringKey? {
        StringKey(rawValue: "stage.\(n)")
    }
}

/// The app's strings in one member's language: the language set for them at
/// onboarding (GET /api/members), never the device's. Lookups go to that
/// language's table in the String Catalog directly, so Lakshmi's phone reads
/// Telugu whatever the phone itself is set to.
struct Strings: Sendable {
    let language: String
    let isTelugu: Bool
    private let table: Bundle

    private final class BundleToken {}

    init(language: String) {
        self.language = language
        isTelugu = language.lowercased().hasPrefix("te")
        let app = Bundle(for: BundleToken.self)
        let code = isTelugu ? "te" : "en"
        table = app.path(forResource: code, ofType: "lproj").flatMap(Bundle.init(path:)) ?? app
    }

    var locale: Locale { Locale(identifier: isTelugu ? "te_IN" : "en_IN") }

    /// The string for `key`, with `{name}` placeholders filled from `values`.
    func t(_ key: StringKey, _ values: [String: String] = [:]) -> String {
        var text = table.localizedString(forKey: key.rawValue, value: nil, table: "Localizable")
        for (name, value) in values {
            text = text.replacingOccurrences(of: "{\(name)}", with: value)
        }
        return text
    }

    /// The family's clock is at +05:30 (config/onboarding.json, sim_clock).
    private static let familyZone = TimeZone(identifier: "Asia/Kolkata")!
    private static let utc = TimeZone(identifier: "UTC")!

    private func formatter(_ template: String, zone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = zone
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }

    private static func instant(_ iso: String) -> Date? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    /// A calendar date (YYYY-MM-DD) as day and month, with the year when it is not `today`'s.
    func date(_ iso: String, today: String? = nil) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        parser.timeZone = Self.utc
        guard let day = parser.date(from: String(iso.prefix(10))) else { return iso }
        let otherYear = today.map { $0.prefix(4) != iso.prefix(4) } ?? false
        return formatter(otherYear ? "d MMM y" : "d MMM", zone: Self.utc).string(from: day)
    }

    /// A sim-time instant as the weekday and date on the family's clock.
    func longDate(_ iso: String) -> String {
        Self.instant(iso).map { formatter("EEEE d MMMM", zone: Self.familyZone).string(from: $0) } ?? iso
    }

    /// A sim-time instant as the time on the family's clock.
    func time(_ iso: String) -> String {
        Self.instant(iso).map { formatter("h:mm a", zone: Self.familyZone).string(from: $0) } ?? iso
    }

    /// An amount in rupees, grouped as India writes it: ₹4,680.
    func rupees(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_IN")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        return "₹" + (formatter.string(from: NSNumber(value: value)) ?? String(value))
    }

    func num(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }
}
