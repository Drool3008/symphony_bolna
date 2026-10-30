import SwiftUI

/// The member's one conversation with the agent (brief, Stage I4), laid out
/// as the reference's AgentChat (src/components/AgentChat.tsx,
/// UI Components/07-arun-chat-receipts.png): the agent's lines on the left
/// with its sparkle avatar, the member's own on the right in green, on the
/// chat wall. Only this member's thread is shown; the server has no read
/// route yet, so it is the stream's (AgentThreadStore).
struct ChatScreen: View {
    let me: MemberSummary
    let s: Strings
    @Environment(AgentThreadStore.self) private var threads
    @Environment(AppModel.self) private var model

    var body: some View {
        let messages = threads.messages(for: me.id)
        let open = threads.openCards(for: me.id)
        ScrollViewReader { proxy in
            VStack(spacing: 0) {
                if let first = open.first {
                    DecisionsBar(count: open.count, s: s) {
                        withAnimation { proxy.scrollTo(first.id, anchor: .center) }
                    }
                }
                ScrollView {
                    VStack(spacing: 0) {
                        if messages.isEmpty {
                            Text(s.t(.noMessages))
                                .font(Tokens.Fonts.body)
                                .foregroundStyle(Tokens.muted)
                                .padding(.top, 40)
                                .accessibilityIdentifier("no-messages")
                        }
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                            let first = index == 0 || messages[index - 1].from != message.from
                            MessageRow(message: message, me: me, s: s, firstOfRun: first, threads: threads)
                                .padding(.top, first ? Tokens.space3 : Tokens.space1)
                                .id(message.id)
                        }
                        if model.session.thinking {
                            ThinkingRow(s: s).padding(.top, Tokens.space3)
                        }
                        Color.clear.frame(height: 1).id(Self.bottom)
                    }
                    .padding(.horizontal, Tokens.space3)
                    .padding(.vertical, Tokens.space3)
                }
                .defaultScrollAnchor(.bottom)
                .scrollDismissesKeyboard(.interactively)
                .background { ChatWall() }
                .onChange(of: messages.count) { proxy.scrollTo(Self.bottom, anchor: .bottom) }
                .onChange(of: model.session.thinking) { proxy.scrollTo(Self.bottom, anchor: .bottom) }
            }
        }
        // Chat is open: what the agent has said is seen, and stays seen as more arrives.
        .onAppear { threads.markSeen(me.id) }
        .onChange(of: messages.count) { threads.markSeen(me.id) }
    }

    static let bottom = "bottom"
}

/// One line in the thread. The agent's: its avatar on the first of a run, a
/// card-coloured bubble with its tail at the bottom left and a "Vantari · AI"
/// label. The member's own: a green bubble on the right with their avatar.
/// Lines from the same speaker in a row sit close under one avatar.
struct MessageRow: View {
    let message: ThreadMessage
    let me: MemberSummary
    let s: Strings
    let firstOfRun: Bool
    let threads: AgentThreadStore

    private var mine: Bool { message.from != "agent" }
    private static let avatar: CGFloat = 28

    var body: some View {
        HStack(alignment: .bottom, spacing: Tokens.space2) {
            if mine {
                Spacer(minLength: 40)
            } else if firstOfRun {
                AgentAvatar(size: Self.avatar)
            } else {
                Color.clear.frame(width: Self.avatar + 2, height: 1)
            }
            bubble
                .frame(maxWidth: message.card == nil ? nil : .infinity, alignment: .leading)
            if !mine {
                Spacer(minLength: 24)
            } else if firstOfRun {
                PersonAvatar(name: message.from == me.id ? me.name : message.from, size: Self.avatar)
            } else {
                Color.clear.frame(width: Self.avatar, height: 1)
            }
        }
    }

    private var shape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: Tokens.radiusCard,
            bottomLeadingRadius: mine ? Tokens.radiusCard : Tokens.radiusTail,
            bottomTrailingRadius: mine ? Tokens.radiusTail : Tokens.radiusCard,
            topTrailingRadius: Tokens.radiusCard
        )
    }

    private var bubble: some View {
        VStack(alignment: .leading, spacing: 2) {
            if !mine, firstOfRun {
                Text("\(Product.name) · AI")
                    .font(Tokens.Fonts.badge)
                    .foregroundStyle(Tokens.ai)
            }
            if !message.text.isEmpty {
                Text(message.text)
                    .font(Tokens.Fonts.body)
                    .foregroundStyle(Tokens.ink)
                    .lineSpacing(Tokens.lineSpacing(forLanguage: message.language))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("line-\(message.id)")
            }
            if message.card != nil {
                DecisionCard(
                    message: message, s: s,
                    onAnswer: { label in Task { await threads.answer(message, with: label) } },
                    sending: threads.sending[message.id],
                    refusal: threads.refusals[message.id].map { $0 == .offline ? s.t(.offline) : $0.message }
                )
                .padding(.top, 6)
            }
            Text(s.time(message.at))
                .font(.caption)
                .foregroundStyle(Tokens.muted)
                .frame(maxWidth: message.card == nil ? nil : .infinity, alignment: .trailing)
                .padding(.top, 2)
        }
        .padding(.horizontal, Tokens.space3)
        .padding(.vertical, Tokens.space2)
        .background(mine ? Tokens.chatMine : Tokens.card, in: shape)
        .overlay {
            if !mine { shape.strokeBorder(Tokens.ai.opacity(0.12), lineWidth: 1) }
        }
        .bubbleShadow()
        .accessibilityElement(children: .contain)
    }
}

/// How many cards wait on this member, in an amber bar under the header; a
/// tap brings the first into view (the reference's bar, AgentChat.tsx). The
/// cards stay where they are in the thread.
struct DecisionsBar: View {
    let count: Int
    let s: Strings
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Tokens.space2) {
                Image(systemName: "hand.raised.fill").accessibilityHidden(true)
                Text(s.t(count == 1 ? .decisionsWaitingOne : .decisionsWaiting, ["n": s.num(Double(count))]))
                    .lineLimit(2)
                Spacer(minLength: 0)
                Image(systemName: "arrow.down").accessibilityHidden(true)
            }
            .font(Tokens.Fonts.meta.weight(.bold))
            .foregroundStyle(Tokens.human)
            .padding(.horizontal, Tokens.space3)
            .padding(.vertical, Tokens.space2)
            .frame(maxWidth: .infinity, minHeight: Tokens.touch, alignment: .leading)
            .background(Tokens.humanBg)
            .overlay(alignment: .bottom) { Rectangle().fill(Tokens.human.opacity(0.3)).frame(height: 1) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("decisions-waiting")
    }
}

/// The agent at work: its avatar and three bouncing violet dots, from a
/// `thinking` event until `idle`. Still dots under Reduce Motion.
struct ThinkingRow: View {
    let s: Strings
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .center, spacing: Tokens.space2) {
            AgentAvatar(size: 28)
            TimelineView(.animation(paused: reduceMotion)) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                HStack(spacing: Tokens.space1) {
                    ForEach(0..<3) { i in
                        Circle()
                            .fill(Tokens.ai)
                            .frame(width: 8, height: 8)
                            .offset(y: reduceMotion ? 0 : -4 * max(0, sin((t * 2 * .pi / 0.9) - Double(i) * 0.7)))
                    }
                }
            }
            .padding(.horizontal, Tokens.space3)
            .padding(.vertical, 10)
            .background(
                Tokens.card,
                in: UnevenRoundedRectangle(
                    topLeadingRadius: Tokens.radiusCard, bottomLeadingRadius: Tokens.radiusTail,
                    bottomTrailingRadius: Tokens.radiusCard, topTrailingRadius: Tokens.radiusCard
                )
            )
            .bubbleShadow()
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(s.t(.working))
        .accessibilityIdentifier("thinking")
    }
}

/// The chat's wall: `chat-wall` under a faint dot every 18 points (the
/// reference's `.chat-wall` in src/index.css).
struct ChatWall: View {
    var body: some View {
        Tokens.chatWall
            .overlay {
                Canvas { context, size in
                    let dot = Tokens.ink.opacity(0.07)
                    var y: CGFloat = 9
                    while y < size.height {
                        var x: CGFloat = 9
                        while x < size.width {
                            context.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)), with: .color(dot))
                            x += 18
                        }
                        y += 18
                    }
                }
            }
            .accessibilityHidden(true)
    }
}
