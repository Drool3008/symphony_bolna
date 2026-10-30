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
    /// today's (backend ask 10).
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
}

/// A section's label over a thin rule.
struct SectionLabel: View {
    let text: String
    let s: Strings

    var body: some View {
        Text(text)
            .font(Tokens.Fonts.badge)
            .foregroundStyle(Tokens.muted)
            .lineSpacing(s.lineSpacing)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, Tokens.space2)
            .overlay(alignment: .bottom) { Rectangle().fill(Tokens.line).frame(height: 1) }
            .accessibilityAddTraits(.isHeader)
    }
}

/// One medicine: what it is on the left, its days of cover as the figure on
/// the right. At the accessibility text sizes the figure goes under the name.
struct MedicineRow: View {
    let m: HomeMedicine
    let s: Strings
    let today: String
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .body) private var figure = 44

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Tokens.space3))
            : AnyLayout(HStackLayout(alignment: .top, spacing: Tokens.space3))
        layout {
            VStack(alignment: .leading, spacing: Tokens.space1) {
                Text("\(Text(m.name).font(Tokens.Fonts.card).foregroundStyle(Tokens.ink))  \(Text(m.strength).font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted))")
                Text(m.purpose).font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
                Text(HomeLines.stock(m, s, today: today))
                    .font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
                    .accessibilityIdentifier("stock-\(m.id)")
                if m.mustNotMiss {
                    // A shape and a word, never colour alone.
                    Label {
                        Text(s.t(.mustNotMiss))
                    } icon: {
                        Image(systemName: "exclamationmark.square.fill").accessibilityHidden(true)
                    }
                    .font(Tokens.Fonts.badge)
                    .foregroundStyle(Tokens.ink)
                    .padding(.top, Tokens.space1)
                }
            }
            .lineSpacing(s.lineSpacing)
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: typeSize.isAccessibilitySize ? .leading : .trailing, spacing: Tokens.space1) {
                Text(s.num(Double(m.daysOfCover)))
                    .font(.system(size: figure, weight: .bold))
                    .foregroundStyle(Tokens.ink)
                Text(s.t(.daysLeftLabel)).font(Tokens.Fonts.badge).foregroundStyle(Tokens.ink)
                Text(s.t(.runsOut, ["d": s.date(m.runsOutOn, today: today)]))
                    .font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
            }
            .multilineTextAlignment(typeSize.isAccessibilitySize ? .leading : .trailing)
            .lineSpacing(s.lineSpacing)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("cover-\(m.id)")
        }
        .padding(.vertical, Tokens.space3)
        .overlay(alignment: .bottom) { Rectangle().fill(Tokens.line).frame(height: 1) }
    }
}

/// A recurring test: when it falls due, or since when it is overdue, and when it was last done.
struct TestRow: View {
    let t: HomeTest
    let s: Strings
    let today: String

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.space1) {
            Text(t.name).font(Tokens.Fonts.card).foregroundStyle(Tokens.ink)
            if t.overdue {
                // A shape and a word, never colour alone.
                Label {
                    Text(HomeLines.due(t, s, today: today))
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill").accessibilityHidden(true)
                }
                .font(Tokens.Fonts.meta.weight(.semibold))
                .foregroundStyle(Tokens.ink)
                .accessibilityIdentifier("due-\(t.id)")
            } else {
                Text(HomeLines.due(t, s, today: today))
                    .font(Tokens.Fonts.meta).foregroundStyle(Tokens.ink)
                    .accessibilityIdentifier("due-\(t.id)")
            }
            Text(HomeLines.lastDone(t, s, today: today))
                .font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
        }
        .lineSpacing(s.lineSpacing)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, Tokens.space3)
        .overlay(alignment: .bottom) { Rectangle().fill(Tokens.line).frame(height: 1) }
    }
}

/// One member's record, as far as consent lets the asking member see it.
/// Tests are shown for the member's own record only, as on the web.
struct RecordView: View {
    let home: MemberHomeResponse
    let s: Strings
    let heading: String
    var testsHeading: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(text: heading, s: s)
            if home.medicines.isEmpty {
                Text(s.t(.nothingOnFile))
                    .font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
                    .padding(.vertical, Tokens.space3)
            } else {
                ForEach(home.medicines) { m in
                    MedicineRow(m: m, s: s, today: home.today)
                }
            }
            if let testsHeading, !home.tests.isEmpty {
                SectionLabel(text: testsHeading, s: s).padding(.top, Tokens.space5)
                ForEach(home.tests) { t in
                    TestRow(t: t, s: s, today: home.today)
                }
            }
        }
    }
}

/// The agent's latest word to this member. The server sends null until the
/// agent has written to them, and always today (backend ask 3); then the slot
/// draws nothing: no placeholder.
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
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel(text: s.t(.latest), s: s)
                VStack(alignment: .leading, spacing: Tokens.space1) {
                    Label {
                        Text(s.t(.agent))
                    } icon: {
                        Image(systemName: "diamond.fill").imageScale(.small).accessibilityHidden(true)
                    }
                    .font(Tokens.Fonts.badge)
                    .foregroundStyle(Tokens.muted)
                    Text(word)
                        .font(Tokens.Fonts.body)
                        .foregroundStyle(Tokens.ink)
                        .accessibilityIdentifier("latest-word")
                }
                .lineSpacing(s.lineSpacing)
                .padding(.leading, Tokens.space3)
                .padding(.vertical, Tokens.space3)
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("latest")
        }
    }
}

/// Home (brief, Stage I3), as the web client's src/screens/Home.tsx: the
/// member's own record, then each other member's when their consent gives this
/// member the full view. The server has filtered it already.
struct HomeScreen: View {
    let me: MemberSummary
    let others: [MemberSummary]
    let s: Strings
    @Environment(HomeStore.self) private var homes

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.space5) {
                if let problem = homes.problems[me.id] {
                    Text(problem == .offline ? s.t(.offline) : problem.message)
                        .font(Tokens.Fonts.meta).bold()
                        .foregroundStyle(Tokens.ink)
                        .lineSpacing(s.lineSpacing)
                        .accessibilityIdentifier("home-problem")
                }
                if let home = homes.homes[me.id] {
                    LatestWordView(word: home.latestAgentWord, s: s)
                    RecordView(home: home, s: s, heading: s.t(.medicines), testsHeading: s.t(.tests))
                    ForEach(others) { other in
                        if let theirs = homes.homes[other.id], theirs.shared == .full, !theirs.medicines.isEmpty {
                            RecordView(home: theirs, s: s, heading: s.t(.whose, ["name": other.name]))
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
}
