import SwiftUI

/// The bottom tabs, as the reference's Nav (src/PhoneApp.tsx): a bar on
/// `card` with a line along its top; each tab an icon in a 56 by 32 pill,
/// filled `stage` when it is the open tab, over its word. Chat carries a red
/// count of the agent's messages this member has not seen yet or, with none
/// unseen, an amber dot while something waits on their answer.
struct TabBar: View {
    let tabs: [AppTab]
    @Binding var selection: TabID
    let s: Strings
    /// The agent's messages to this member not seen since they last opened Chat.
    var unread = 0
    /// Something waits on this member's answer.
    var nudge = false

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in
                item(tab)
            }
        }
        .padding(.horizontal, Tokens.space1)
        .padding(.top, 6)
        .padding(.bottom, Tokens.space1)
        .background(Tokens.card.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Tokens.line).frame(height: 1) }
        // Labels grow to the largest standard size; beyond it the bar would crowd out the screen.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func item(_ tab: AppTab) -> some View {
        let on = tab.id == selection
        let count = tab.id == .agent ? unread : 0
        let dot = tab.id == .agent && nudge && count == 0
        return Button {
            selection = tab.id
        } label: {
            VStack(spacing: 2) {
                Image(systemName: on ? tab.symbol + ".fill" : tab.symbol)
                    .font(.system(size: 19, weight: on ? .semibold : .regular))
                    .foregroundStyle(on ? Tokens.onStrong : Tokens.muted)
                    .frame(width: 56, height: 32)
                    .background(on ? Tokens.stage : .clear, in: Capsule())
                    .overlay(alignment: .topTrailing) {
                        if count > 0 {
                            Text(s.num(Double(count)))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Tokens.onStrong)
                                .padding(.horizontal, Tokens.space1)
                                .frame(minWidth: 18, minHeight: 18)
                                .background(Tokens.decision, in: Capsule())
                                .overlay { Capsule().strokeBorder(Tokens.card, lineWidth: 2) }
                                .offset(x: 2, y: -4)
                        } else if dot {
                            Circle()
                                .fill(Tokens.human)
                                .frame(width: 12, height: 12)
                                .overlay { Circle().strokeBorder(Tokens.card, lineWidth: 2) }
                                .offset(x: 2, y: -2)
                        }
                    }
                Text(s.t(tab.label))
                    .font(Tokens.Fonts.meta.weight(on ? .bold : .medium))
                    .foregroundStyle(on ? Tokens.stage : Tokens.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: Tokens.touch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(s.t(tab.label))
        .accessibilityValue(count > 0 ? s.t(.unread, ["n": s.num(Double(count))]) : dot ? s.t(.needsAnswer) : "")
        .accessibilityAddTraits(on ? [.isSelected] : [])
        .accessibilityIdentifier("tab-\(tab.id.rawValue)")
    }
}
