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
}

/// A section's label over a thin rule.
struct SectionLabel: View {
    let text: String
    let s: Strings

    var body: some View {
        Text(text)
            .font(Tokens.label)
            .foregroundStyle(Tokens.ink2)
            .lineSpacing(s.lineSpacing)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, Tokens.space2)
            .overlay(alignment: .bottom) { Rectangle().fill(Tokens.rule).frame(height: Tokens.ruleThin) }
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
    @ScaledMetric(relativeTo: .body) private var figure = Tokens.figureSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Tokens.space3))
            : AnyLayout(HStackLayout(alignment: .top, spacing: Tokens.space3))
        layout {
            VStack(alignment: .leading, spacing: Tokens.space1) {
                Text("\(Text(m.name).font(Tokens.title).foregroundStyle(Tokens.ink))  \(Text(m.strength).font(Tokens.meta).foregroundStyle(Tokens.ink2))")
                Text(m.purpose).font(Tokens.meta).foregroundStyle(Tokens.ink2)
                Text(HomeLines.stock(m, s, today: today))
                    .font(Tokens.meta).foregroundStyle(Tokens.ink2)
                    .accessibilityIdentifier("stock-\(m.id)")
                if m.mustNotMiss {
                    // A shape and a word, never colour alone.
                    Label {
                        Text(s.t(.mustNotMiss))
                    } icon: {
                        Image(systemName: "exclamationmark.square.fill").accessibilityHidden(true)
                    }
                    .font(Tokens.label)
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
                Text(s.t(.daysLeftLabel)).font(Tokens.label).foregroundStyle(Tokens.ink)
                Text(s.t(.runsOut, ["d": s.date(m.runsOutOn, today: today)]))
                    .font(Tokens.meta).foregroundStyle(Tokens.ink2)
            }
            .multilineTextAlignment(typeSize.isAccessibilitySize ? .leading : .trailing)
            .lineSpacing(s.lineSpacing)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("cover-\(m.id)")
        }
        .padding(.vertical, Tokens.space3)
        .overlay(alignment: .bottom) { Rectangle().fill(Tokens.rule).frame(height: Tokens.ruleThin) }
    }
}

/// One member's record, as far as consent lets the asking member see it.
struct RecordView: View {
    let home: MemberHomeResponse
    let s: Strings
    let heading: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(text: heading, s: s)
            if home.medicines.isEmpty {
                Text(s.t(.nothingOnFile))
                    .font(Tokens.meta).foregroundStyle(Tokens.ink2)
                    .padding(.vertical, Tokens.space3)
            } else {
                ForEach(home.medicines) { m in
                    MedicineRow(m: m, s: s, today: home.today)
                }
            }
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
                        .font(Tokens.meta).bold()
                        .foregroundStyle(Tokens.ink)
                        .lineSpacing(s.lineSpacing)
                        .accessibilityIdentifier("home-problem")
                }
                if let home = homes.homes[me.id] {
                    RecordView(home: home, s: s, heading: s.t(.medicines))
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
