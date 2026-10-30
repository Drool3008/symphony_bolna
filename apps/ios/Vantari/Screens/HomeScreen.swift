import SwiftUI

/// The words on a home row, kept apart from the layout so tests can read
/// them. The same wording as the web client's src/screens/Home.tsx.
enum HomeLines {
    static func unitWord(_ s: Strings, _ unit: String) -> String {
        switch unit {
        case "pills": s.t(.unitPills)
        case "doses": s.t(.unitDoses)
        default: unit
        }
    }

    /// The stock as the server counted it. Once the clock has moved past the
    /// day it was counted, the line says so, so the count is never read as
    /// today's.
    static func stock(_ m: HomeMedicine, _ s: Strings, today: String) -> String {
        let n = "\(s.num(m.stock)) \(unitWord(s, m.unit))"
        return m.stockAsOf == today
            ? s.t(.stockLeft, ["n": n])
            : s.t(.stockCounted, ["n": n, "d": s.date(m.stockAsOf, today: today)])
    }

    /// When a test falls due. Overdue is said as overdue: the server sends a
    /// negative days_until_due and `overdue` (server/src/domain/home.ts).
    static func due(_ t: HomeTest, _ s: Strings, today: String) -> String {
        s.t(t.overdue ? .overdue : .nextDue, ["d": s.date(t.nextDue, today: today)])
    }

    static func lastDone(_ t: HomeTest, _ s: Strings, today: String) -> String {
        "\(s.t(.lastDone, ["d": s.date(t.lastDone, today: today)])) · \(s.t(.everyNDays, ["n": s.num(Double(t.everyDays))]))"
    }

    /// Days of cover at or under this show red, with the refill line: the
    /// reference's presentation (src/PhoneApp.tsx, `days <= 5`). The figure is
    /// the server's; only the colour is decided here.
    static let lowCover = 5

    static func isLow(_ m: HomeMedicine) -> Bool { m.daysOfCover <= lowCover }

    /// How full the cover bar is: a month is a full bar, never under 4% so it
    /// still shows (src/PhoneApp.tsx).
    static func coverFraction(_ m: HomeMedicine) -> Double {
        min(1, max(0.04, Double(m.daysOfCover) / 30))
    }

    /// What a tap on a medicine says to the agent, in the reference's words (src/PhoneApp.tsx).
    static func refillRequest(_ m: HomeMedicine, owner: String) -> String {
        "Please refill \(m.name) \(m.strength) for \(owner)"
    }

    /// What a tap on a test's booking row says to the agent (src/PhoneApp.tsx).
    static func bookingRequest(_ t: HomeTest) -> String {
        "Please book my \(t.name)."
    }
}

/// A section's heading: a small rounded-square chip with its sign, and the
/// label in muted capitals (the reference's SectionTitle, src/PhoneApp.tsx).
struct SectionTitle: View {
    let text: String
    let symbol: String
    let tint: Color
    let wash: Color
    let s: Strings

    var body: some View {
        HStack(spacing: Tokens.space2) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 24, height: 24)
                .background(wash, in: RoundedRectangle(cornerRadius: 8))
                .accessibilityHidden(true)
            Text(text.uppercased(with: s.locale))
                .font(Tokens.Fonts.meta.weight(.bold))
                .tracking(0.6)
                .foregroundStyle(Tokens.muted)
                .lineSpacing(s.lineSpacing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Two pieces of text on one line with a dot between when they fit, else
/// one under the other without it.
private struct TwoPart<First: View, Second: View>: View {
    @ViewBuilder let first: () -> First
    @ViewBuilder let second: () -> Second

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: Tokens.space1) {
                first()
                Text("·").accessibilityHidden(true)
                second()
            }
            VStack(alignment: .leading, spacing: 2) {
                first()
                second()
            }
        }
    }
}

/// One medicine, as the reference's medicine card (src/PhoneApp.tsx,
/// UI Components/01-lakshmi-home.png): its name and strength, the days of
/// cover in a red or green chip, a bar for how much is left, the
/// must-not-miss chip, and when the stock was counted and runs out. A tap
/// asks the agent for a refill.
struct MedicineCard: View {
    let m: HomeMedicine
    let s: Strings
    let today: String
    let onTap: () -> Void
    var problem: String?
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let low = HomeLines.isLow(m)
        VStack(alignment: .leading, spacing: 10) {
            let layout = typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: Tokens.space2))
                : AnyLayout(HStackLayout(alignment: .top, spacing: Tokens.space2))
            layout {
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.name)
                        .font(Tokens.Fonts.card)
                        .foregroundStyle(Tokens.ink)
                        .accessibilityAddTraits(.isButton)
                        .accessibilityHint(HomeLines.refillRequest(m, owner: ""))
                        .accessibilityAction { onTap() }
                    Text("\(m.strength) · \(m.purpose)")
                        .font(Tokens.Fonts.meta)
                        .foregroundStyle(Tokens.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(s.t(.daysLeft, ["n": s.num(Double(m.daysOfCover))]))
                    .font(Tokens.Fonts.meta.weight(.bold))
                    .foregroundStyle(low ? Tokens.decision : Tokens.ok)
                    .padding(.horizontal, 10)
                    .padding(.vertical, Tokens.space1)
                    .background(low ? Tokens.decisionBg : Tokens.okBg, in: Capsule())
                    // One line, as the reference's chip; the name beside it wraps instead.
                    .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: true)
                    .accessibilityIdentifier("cover-\(m.id)")
            }
            GeometryReader { box in
                Capsule().fill(Tokens.secondary)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(LinearGradient(
                                colors: low ? [Self.lowStart, Tokens.decision] : [Self.okStart, Tokens.ok],
                                startPoint: .leading, endPoint: .trailing
                            ))
                            .frame(width: box.size.width * HomeLines.coverFraction(m))
                    }
            }
            .frame(height: 8)
            .accessibilityHidden(true)
            if m.mustNotMiss {
                // A shape and a word, never colour alone.
                Label {
                    Text(s.t(.mustNotMiss))
                } icon: {
                    Image(systemName: "exclamationmark.triangle").accessibilityHidden(true)
                }
                .font(Tokens.Fonts.meta.weight(.semibold))
                .foregroundStyle(Tokens.decision)
                .padding(.horizontal, Tokens.space2)
                .padding(.vertical, 2)
                .background(Tokens.decisionBg, in: Capsule())
            }
            TwoPart {
                Text(HomeLines.stock(m, s, today: today))
                    .accessibilityIdentifier("stock-\(m.id)")
            } second: {
                Text(s.t(.runsOut, ["d": s.date(m.runsOutOn, today: today)]))
            }
            .font(Tokens.Fonts.meta)
            .foregroundStyle(Tokens.muted)
            if low {
                Label {
                    Text(s.t(.tapToRefill))
                } icon: {
                    Image(systemName: "chevron.right").imageScale(.small).accessibilityHidden(true)
                }
                .font(Tokens.Fonts.meta)
                .foregroundStyle(Tokens.decision)
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { onTap() }
            }
            if let problem {
                Text(problem)
                    .font(Tokens.Fonts.meta.weight(.semibold))
                    .foregroundStyle(Tokens.decision)
                    .accessibilityIdentifier("tap-problem")
            }
        }
        .lineSpacing(s.lineSpacing)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
        .cardShadow()
        .contentShape(RoundedRectangle(cornerRadius: Tokens.radiusCard))
        .onTapGesture(perform: onTap)
    }

    /// The bars' light ends, from the reference's gradients (`#F87171`, `#34D399`).
    private static let lowStart = Tokens.dynamic(0xF87171, 0xF87171)
    private static let okStart = Tokens.dynamic(0x34D399, 0x34D399)
}

/// A recurring test, as the reference's test card (src/PhoneApp.tsx): its
/// name, when it was last done and how often, and when it falls due, overdue
/// in bold red with a warning sign and a faint red ring. Its booking row asks
/// the agent to book it.
struct TestCard: View {
    let t: HomeTest
    let s: Strings
    let today: String
    let onBook: () -> Void
    var sending = false
    var problem: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.space1) {
            HStack(alignment: .top) {
                Text(t.name).font(Tokens.Fonts.card).foregroundStyle(Tokens.ink)
                Spacer(minLength: Tokens.space2)
                if t.overdue {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Tokens.decision)
                        .accessibilityHidden(true)
                }
            }
            Text(HomeLines.lastDone(t, s, today: today))
                .font(Tokens.Fonts.meta)
                .foregroundStyle(Tokens.muted)
            Text(HomeLines.due(t, s, today: today))
                .font(t.overdue ? Tokens.Fonts.meta.weight(.bold) : Tokens.Fonts.meta)
                .foregroundStyle(t.overdue ? Tokens.decision : Tokens.muted)
                .accessibilityIdentifier("due-\(t.id)")
            Button(action: onBook) {
                HStack(spacing: Tokens.space2) {
                    Label {
                        Text(sending ? s.t(.sending) : s.t(.bookIt))
                    } icon: {
                        Image(systemName: "calendar.badge.plus").accessibilityHidden(true)
                    }
                    .font(Tokens.Fonts.meta.weight(.bold))
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).accessibilityHidden(true)
                }
                .foregroundStyle(Tokens.stage)
                .padding(.horizontal, Tokens.space3)
                .padding(.vertical, Tokens.space2)
                .frame(minHeight: Tokens.touch)
                .background(Tokens.stageBg, in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
                .contentShape(RoundedRectangle(cornerRadius: Tokens.radiusControl))
            }
            .buttonStyle(.plain)
            .disabled(sending)
            .padding(.top, 6)
            .accessibilityIdentifier("book-\(t.id)")
            if let problem {
                Text(problem)
                    .font(Tokens.Fonts.meta.weight(.semibold))
                    .foregroundStyle(Tokens.decision)
                    .accessibilityIdentifier("tap-problem")
            }
        }
        .lineSpacing(s.lineSpacing)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
        .cardShadow()
        .overlay {
            if t.overdue {
                RoundedRectangle(cornerRadius: Tokens.radiusCard).strokeBorder(Tokens.decision.opacity(0.4), lineWidth: 2)
            }
        }
    }
}

/// The agent's latest word to this member, in a white card marked as the
/// agent's (the reference's "Latest from your agent", src/PhoneApp.tsx). The
/// server sends null until the agent has written to them, and always today
/// (backend ask 3); then the card draws nothing: no placeholder.
struct LatestWordView: View {
    let word: String?
    let s: Strings

    /// The words to show, or nil when there is nothing to show.
    static func shown(_ word: String?) -> String? {
        guard let word, !word.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return word
    }

    var body: some View {
        if let word = Self.shown(word) {
            VStack(alignment: .leading, spacing: Tokens.space2) {
                HStack(spacing: Tokens.space2) {
                    AgentAvatar(size: 30)
                    Text(s.t(.latest))
                        .font(Tokens.Fonts.meta.weight(.bold))
                        .foregroundStyle(Tokens.ink)
                    Spacer(minLength: Tokens.space2)
                    AITag()
                }
                Text(word)
                    .font(Tokens.Fonts.body)
                    .foregroundStyle(Tokens.ink)
                    .accessibilityIdentifier("latest-word")
            }
            .lineSpacing(s.lineSpacing)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
            .overlay { RoundedRectangle(cornerRadius: Tokens.radiusCard).strokeBorder(Tokens.ai.opacity(0.15), lineWidth: 1) }
            .cardShadow()
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("latest")
        }
    }
}

/// Something waits on this member's answer: an amber card with a hand that
/// opens Chat (the reference's "Needs your answer" banner, src/PhoneApp.tsx).
struct NeedsAnswerBanner: View {
    let what: String?
    let s: Strings
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(alignment: .top, spacing: Tokens.space3) {
                Image(systemName: "hand.raised.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Tokens.onStrong)
                    .frame(width: 36, height: 36)
                    .background(Tokens.human, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(s.t(.needsAnswer).uppercased(with: s.locale))
                            .font(Tokens.Fonts.meta.weight(.bold))
                            .tracking(0.6)
                            .foregroundStyle(Tokens.human)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.human)
                            .accessibilityHidden(true)
                    }
                    if let what {
                        Text(what).font(Tokens.Fonts.body).foregroundStyle(Tokens.ink).multilineTextAlignment(.leading)
                    }
                }
            }
            .lineSpacing(s.lineSpacing)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.humanBg, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
            .overlay { RoundedRectangle(cornerRadius: Tokens.radiusCard).strokeBorder(Tokens.human.opacity(0.5), lineWidth: 2) }
            .cardShadow()
            .contentShape(RoundedRectangle(cornerRadius: Tokens.radiusCard))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("needs-answer")
    }
}

/// Home (brief, Stage I3), in the reference's look (src/PhoneApp.tsx, Home):
/// what waits on this member, the agent's latest word, their medicines and
/// each other member's whose consent gives this member the full view, then
/// their tests. Everything comes from GET /api/members/:id/home, filtered by
/// the server; days and dates are the server's, never the device's.
struct HomeScreen: View {
    let me: MemberSummary
    let others: [MemberSummary]
    let s: Strings
    /// Opens Chat, after a refill tap or from the banner.
    let openChat: () -> Void
    @Environment(HomeStore.self) private var homes
    @Environment(AgentThreadStore.self) private var threads
    /// A tap on its way to the server, by the card's id.
    @State private var sending: String?
    /// Why the server did not take a tap, by the card's id.
    @State private var problems: [String: String] = [:]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.space5) {
                if let problem = homes.problems[me.id] {
                    Text(problem == .offline ? s.t(.offline) : problem.message)
                        .font(Tokens.Fonts.meta).bold()
                        .foregroundStyle(Tokens.decision)
                        .lineSpacing(s.lineSpacing)
                        .accessibilityIdentifier("home-problem")
                }
                if threads.waitsOnAnswer(from: me.id) {
                    NeedsAnswerBanner(
                        what: threads.waits(on: me.id).first?.whatFor
                            ?? threads.openCards(for: me.id).first.flatMap(CardLabels.title),
                        s: s,
                        open: openChat
                    )
                }
                if let home = homes.homes[me.id] {
                    LatestWordView(word: home.latestAgentWord, s: s)
                    medicines(home)
                    if !home.tests.isEmpty {
                        VStack(alignment: .leading, spacing: Tokens.space2) {
                            SectionTitle(text: s.t(.tests), symbol: "flask", tint: Tokens.test, wash: Tokens.testBg, s: s)
                            ForEach(home.tests) { t in
                                TestCard(
                                    t: t, s: s, today: home.today,
                                    onBook: { send(HomeLines.bookingRequest(t), from: t.id, thenOpenChat: false) },
                                    sending: sending == t.id,
                                    problem: problems[t.id]
                                )
                            }
                        }
                    }
                }
            }
            .padding(Tokens.space4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .refreshable { await homes.reload() }
        .task(id: me.id) { await homes.show([me.id] + others.map(\.id)) }
    }

    @ViewBuilder
    private func medicines(_ home: MemberHomeResponse) -> some View {
        VStack(alignment: .leading, spacing: Tokens.space2) {
            SectionTitle(text: s.t(.medicines), symbol: "pills", tint: Tokens.stage, wash: Tokens.stageBg, s: s)
            if home.medicines.isEmpty {
                Text(s.t(.nothingOnFile)).font(Tokens.Fonts.body).foregroundStyle(Tokens.muted)
            }
            ForEach(home.medicines) { m in
                medicineCard(m, owner: me.name, today: home.today)
            }
            ForEach(others) { other in
                if let theirs = homes.homes[other.id], theirs.shared == .full, !theirs.medicines.isEmpty {
                    HStack(spacing: Tokens.space2) {
                        PersonAvatar(name: other.name, size: 20)
                        Text(s.t(.whose, ["name": other.name]))
                            .font(Tokens.Fonts.meta.weight(.semibold))
                            .foregroundStyle(Tokens.ink)
                            .accessibilityAddTraits(.isHeader)
                    }
                    .padding(.top, Tokens.space2)
                    ForEach(theirs.medicines) { m in
                        medicineCard(m, owner: other.name, today: theirs.today)
                    }
                }
            }
        }
    }

    private func medicineCard(_ m: HomeMedicine, owner: String, today: String) -> some View {
        MedicineCard(
            m: m, s: s, today: today,
            onTap: { send(HomeLines.refillRequest(m, owner: owner), from: "\(owner):\(m.id)", thenOpenChat: true) },
            problem: problems["\(owner):\(m.id)"]
        )
    }

    /// Sends a tap's words through the same path as typing (POST /api/input,
    /// `{ text }` only); the server and the agent decide what follows.
    private func send(_ text: String, from card: String, thenOpenChat: Bool) {
        guard sending == nil else { return }
        sending = card
        problems[card] = nil
        Task {
            let refusal = await threads.say(text)
            sending = nil
            if let refusal {
                problems[card] = refusal == .offline ? s.t(.offline) : refusal.message
            } else if thenOpenChat {
                openChat()
            }
        }
    }
}
