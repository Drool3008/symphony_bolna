import SwiftUI

/// Typing to the agent, as the reference's composer (src/components/AgentChat.tsx):
/// a white bar, a pill-shaped field on `surface`, and a round send button in
/// `stage`, faded while there is nothing to send. Every line goes to
/// POST /api/input and the server decides what it is (server/src/app.ts): the
/// member's reply if the agent is waiting on them, otherwise a new input. The
/// app never decides. The line comes back on the stream as their own bubble.
struct Composer: View {
    let s: Strings
    let send: (String) async -> APIError?
    var focused: FocusState<Bool>.Binding
    @State private var text = ""
    @State private var sending = false
    @State private var problem: String?

    private var line: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.space2) {
            if let problem {
                Text(problem)
                    .font(Tokens.Fonts.meta.weight(.semibold))
                    .foregroundStyle(Tokens.decision)
                    .lineSpacing(s.lineSpacing)
                    .accessibilityIdentifier("composer-problem")
            }
            HStack(spacing: Tokens.space2) {
                TextField("", text: $text, prompt: Text(s.t(.message)).foregroundStyle(Tokens.muted))
                    .font(Tokens.Fonts.body)
                    .foregroundStyle(Tokens.ink)
                    .focused(focused)
                    .submitLabel(.send)
                    .onSubmit(submit)
                    .padding(.horizontal, Tokens.space4)
                    .frame(minHeight: Tokens.touch)
                    .background(Tokens.surface, in: Capsule())
                    .overlay { Capsule().strokeBorder(Tokens.line, lineWidth: 1) }
                    .accessibilityLabel(s.t(.message))
                    .accessibilityIdentifier("composer-field")
                Button(action: submit) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Tokens.onStrong)
                        .frame(width: Tokens.touch, height: Tokens.touch)
                        .background(Tokens.stage, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(line.isEmpty || sending)
                .opacity(line.isEmpty || sending ? 0.4 : 1)
                .accessibilityLabel(sending ? s.t(.sending) : s.t(.send))
                .accessibilityIdentifier("composer-send")
            }
        }
        .padding(.horizontal, Tokens.space3)
        .padding(.vertical, 10)
        .background(Tokens.card)
        .overlay(alignment: .top) { Rectangle().fill(Tokens.line).frame(height: 1) }
    }

    private func submit() {
        let line = line
        guard !line.isEmpty, !sending else { return }
        sending = true
        problem = nil
        Task {
            if let refusal = await send(line) {
                // What was typed stays in the field, so nothing is lost.
                problem = refusal == .offline ? s.t(.offline) : refusal.message
            } else {
                text = ""
            }
            sending = false
        }
    }
}

/// The agent is waiting on this member: an amber strip above the composer
/// with what it waits for (the reference's strip, AgentChat.tsx). Whatever
/// they type next ends the wait, which the server decides.
struct WaitingStrip: View {
    let whatFor: String
    let s: Strings

    var body: some View {
        HStack(spacing: Tokens.space2) {
            Image(systemName: "hand.raised.fill").accessibilityHidden(true)
            Text("\(s.t(.waitingOnYou)) \(whatFor)")
                .lineLimit(1)
                .truncationMode(.tail)
                .accessibilityIdentifier("waiting-on-you")
        }
        .font(Tokens.Fonts.meta.weight(.semibold))
        .foregroundStyle(Tokens.human)
        .padding(.horizontal, Tokens.space3)
        .padding(.vertical, Tokens.space2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.humanBg)
        .overlay(alignment: .top) { Rectangle().fill(Tokens.human.opacity(0.3)).frame(height: 1) }
    }
}
