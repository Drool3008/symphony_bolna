import SwiftUI

/// A card inside the agent's bubble, as the reference's DecisionCard
/// (src/components/AgentChat.tsx): a 2-point border, a band that says where
/// it stands, and the card's own fields. Amber while it waits on this member,
/// green once they said yes, grey for any other answer or for no answer in
/// time, and the agent's violet for a record of something already done. Only
/// fields the card carries are shown; amounts reach only the thread of the
/// person the card was sent to, which the server decides.
struct DecisionCard: View {
    let message: ThreadMessage
    let s: Strings

    private var state: CardState { message.cardState ?? .open }

    private struct Tone {
        let border: Color
        let body: Color
        let band: Color
        let bandText: Color
    }

    /// The band of an approved card: green-100 in light, green-900 in dark (the reference's `#DCFCE7`).
    private static let yesBand = Tokens.dynamic(0xDCFCE7, 0x14532D)

    private var tone: Tone {
        switch state {
        case .open: Tone(border: Tokens.human.opacity(0.6), body: Tokens.humanBg, band: Tokens.humanSoft, bandText: Tokens.human)
        case .yes: Tone(border: Tokens.ok, body: Tokens.okBg, band: Self.yesBand, bandText: Tokens.ok)
        case .other, .timedOut: Tone(border: Tokens.line, body: Tokens.secondary, band: Tokens.secondary, bandText: Tokens.muted)
        case .record: Tone(border: Tokens.ai.opacity(0.2), body: Tokens.aiBg.opacity(0.5), band: Tokens.aiBg, bandText: Tokens.ai)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            band
            VStack(alignment: .leading, spacing: Tokens.space2) {
                fields
                outcome
            }
            .padding(Tokens.space3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone.body)
        .clipShape(RoundedRectangle(cornerRadius: Tokens.radiusCard))
        .overlay { RoundedRectangle(cornerRadius: Tokens.radiusCard).strokeBorder(tone.border, lineWidth: 2) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("card-\(message.id)")
    }

    // MARK: Band

    private var bandWords: (symbol: String, text: String) {
        switch state {
        case .open: ("hand.raised.fill", s.t(.yourDecision))
        case .yes: ("checkmark.circle.fill", CardLabels.pastTense(message.answer ?? ""))
        case .other: ("pause.circle.fill", CardLabels.pastTense(message.answer ?? ""))
        case .timedOut: ("clock", s.t(.noAnswer))
        case .record: ("checkmark.circle", s.t(.done))
        }
    }

    private var band: some View {
        HStack(spacing: Tokens.space2) {
            Label {
                Text(bandWords.text.uppercased(with: s.locale))
                    .accessibilityIdentifier("card-band-\(message.id)")
            } icon: {
                Image(systemName: bandWords.symbol).accessibilityHidden(true)
            }
            .font(Tokens.Fonts.meta.weight(.bold))
            .tracking(0.6)
            .foregroundStyle(tone.bandText)
            Spacer(minLength: Tokens.space1)
            if state == .record {
                AITag()
            } else {
                HumanTag(label: s.t(.humanTag))
            }
        }
        .padding(.horizontal, Tokens.space3)
        .padding(.vertical, 6)
        .background(tone.band)
    }

    // MARK: Fields

    @ViewBuilder
    private var fields: some View {
        if let title = CardLabels.title(message) {
            Text(title).font(Tokens.Fonts.body.weight(.bold)).foregroundStyle(Tokens.ink)
        }
        if let amount = message.cardNumber("amount_inr") {
            Text(rupees(amount)).font(Tokens.Fonts.app).foregroundStyle(Tokens.ink).monospacedDigit()
        }
        let facts = CardLabels.facts.compactMap { fact in message.cardText(fact.key).map { (s.t(fact.label), $0) } }
        if !facts.isEmpty {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: Tokens.space3, verticalSpacing: Tokens.space1) {
                ForEach(facts, id: \.0) { label, value in
                    GridRow {
                        Text(label).foregroundStyle(Tokens.muted)
                        Text(value).fontWeight(.semibold).foregroundStyle(Tokens.ink)
                    }
                }
            }
            .font(Tokens.Fonts.meta)
            .padding(.horizontal, Tokens.space3)
            .padding(.vertical, Tokens.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
        }
        if let detail = message.cardText("detail") {
            Text(detail).font(Tokens.Fonts.meta).foregroundStyle(Tokens.ink)
        }
        receipt
        if let left = message.cardNumber("wallet_left_inr") {
            Text("\(Text(s.t(.walletAfterThis)).foregroundStyle(Tokens.muted)) \(Text(rupees(left)).bold().foregroundStyle(Tokens.ink))")
                .font(Tokens.Fonts.meta)
        }
        options
        if let why = message.cardText("why") {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(s.t(.why)).bold().foregroundStyle(Tokens.ai)
                Text(why).foregroundStyle(Tokens.muted)
            }
            .font(Tokens.Fonts.meta)
        }
    }

    /// Lines with their amounts, and the total apart from them (the reference's receipt panel).
    @ViewBuilder
    private var receipt: some View {
        let items: [(String, Double?)] = {
            guard case let .array(lines)? = message.card?["items"] else { return [] }
            return lines.compactMap { line in
                guard case let .object(item) = line, let label = item["label"]?.string else { return nil }
                return (label, item["amount_inr"]?.number)
            }
        }()
        let number = message.cardText("receipt_no")
        let total = message.cardNumber("total_inr")
        if !items.isEmpty || number != nil || total != nil {
            VStack(alignment: .leading, spacing: Tokens.space1) {
                if let number {
                    Text(s.t(.receiptNo, ["n": number])).foregroundStyle(Tokens.muted)
                }
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: Tokens.space3) {
                        Text(item.0).foregroundStyle(Tokens.ink)
                        Spacer(minLength: 0)
                        if let amount = item.1 {
                            Text(rupees(amount)).fontWeight(.semibold).foregroundStyle(Tokens.ink).monospacedDigit()
                        }
                    }
                }
                if let total {
                    Divider().overlay(Tokens.line)
                    HStack {
                        Text(s.t(.total)).bold()
                        Spacer(minLength: 0)
                        Text(rupees(total)).bold().monospacedDigit()
                    }
                    .foregroundStyle(Tokens.ink)
                }
            }
            .font(Tokens.Fonts.meta)
            .padding(.horizontal, Tokens.space3)
            .padding(.vertical, Tokens.space2)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
        }
    }

    /// The choices the agent lays out, each a label and its value, two to a row.
    @ViewBuilder
    private var options: some View {
        let choices: [(String, String)] = {
            guard case let .array(list)? = message.card?["options"] else { return [] }
            return list.compactMap { entry in
                guard case let .object(option) = entry else { return nil }
                return (option["label"]?.string ?? "", option["value"]?.string ?? "")
            }
        }()
        if !choices.isEmpty {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], alignment: .leading, spacing: 6) {
                ForEach(Array(choices.enumerated()), id: \.offset) { _, choice in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(choice.0.uppercased(with: s.locale)).fontWeight(.semibold).foregroundStyle(Tokens.muted)
                        Text(choice.1).foregroundStyle(Tokens.ink)
                    }
                    .font(Tokens.Fonts.meta)
                    .padding(Tokens.space2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
                }
            }
        }
    }

    // MARK: What became of it

    /// Who decided and when, on a card that is locked: "You chose Approve at
    /// 12:00 am", or what the agent does when nobody answered in time. Only the
    /// card's own recipient may answer it (server/src/app.ts), so the answer is
    /// this member's (backend ask 7).
    @ViewBuilder
    private var outcome: some View {
        switch state {
        case .yes, .other:
            let answer = message.answer ?? ""
            locked(
                message.answeredAt.map { s.t(.youChoseAt, ["a": answer, "t": s.time($0)]) } ?? s.t(.youChose, ["a": answer]),
                yes: state == .yes
            )
        case .timedOut:
            locked(s.t(.noAnswerThen, ["x": message.cardText("on_timeout") ?? s.t(.agentGoesOn)]), yes: false)
        case .open, .record:
            EmptyView()
        }
    }

    private func locked(_ text: String, yes: Bool) -> some View {
        Text(text)
            .font(Tokens.Fonts.meta.weight(.semibold))
            .foregroundStyle(yes ? Tokens.ok : Tokens.muted)
            .padding(.horizontal, Tokens.space3)
            .padding(.vertical, Tokens.space2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
            .padding(.top, 2)
            .accessibilityIdentifier("card-outcome-\(message.id)")
    }

    private func rupees(_ amount: Double) -> String { s.rupees(amount) }
}
