import SwiftUI

/// What the header's status line says: "Working on it…" while the agent is
/// thinking (from a `thinking` event until `idle`), else the stage it set
/// (server/src/agent/tools.ts, set_stage, 0 to 9), else "Here if you need me".
/// The reference's Header in src/PhoneApp.tsx, with its words from src/lib/i18n.ts.
enum StatusLine {
    static func text(stage: Int?, thinking: Bool, _ s: Strings) -> String {
        if thinking { return s.t(.working) }
        if let stage, let key = StringKey.stage(stage) { return s.t(key) }
        return s.t(.here)
    }
}

/// The top of the member's app, as the reference's Header (src/PhoneApp.tsx):
/// the brand gradient; the mark and the product's name, with the family's
/// date on the sim clock under it; the member's avatar and name in a
/// translucent pill, which opens nothing (Profile waits on the session route);
/// and below, what the agent is doing now, marked with the agent's sparkle.
struct ShellHeader: View {
    let me: MemberSummary
    let s: Strings
    let clock: String?
    let stage: Int?
    let thinking: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var lit = false

    var body: some View {
        VStack(spacing: Tokens.space2) {
            HStack(spacing: Tokens.space2) {
                LogoMark(size: 30)
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                    .overlay { RoundedRectangle(cornerRadius: 9).strokeBorder(.white.opacity(0.4), lineWidth: 1) }
                VStack(alignment: .leading, spacing: 0) {
                    Text(Product.name)
                        .font(Tokens.Fonts.brand)
                        .accessibilityAddTraits(.isHeader)
                    if let clock {
                        Text(s.longDate(clock))
                            .font(.caption.weight(.medium))
                            .opacity(0.85)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .accessibilityIdentifier("family-date")
                    }
                }
                Spacer(minLength: Tokens.space2)
                HStack(spacing: 6) {
                    PersonAvatar(name: me.name, size: 24)
                        .overlay { Circle().strokeBorder(.white.opacity(0.6), lineWidth: 1) }
                    Text(me.name)
                        .font(Tokens.Fonts.meta.weight(.semibold))
                        .lineLimit(1)
                        .accessibilityIdentifier("member-name")
                }
                .padding(.leading, Tokens.space1)
                .padding(.trailing, 10)
                .padding(.vertical, Tokens.space1)
                .background(.white.opacity(0.15), in: Capsule())
            }
            HStack(spacing: Tokens.space2) {
                Circle()
                    .fill(.white)
                    .frame(width: 20, height: 20)
                    .overlay { Sparkle().fill(Tokens.brand1).frame(width: 12, height: 12) }
                    .opacity(thinking && !reduceMotion ? (lit ? 1 : 0.35) : 1)
                    .accessibilityHidden(true)
                Text(StatusLine.text(stage: stage, thinking: thinking, s))
                    .font(Tokens.Fonts.meta.weight(.semibold))
                    .lineLimit(1)
                    .accessibilityIdentifier("status-line")
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.white.opacity(0.15), in: RoundedRectangle(cornerRadius: Tokens.radiusControl))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
        }
        .foregroundStyle(Tokens.onBrand)
        .padding(.horizontal, Tokens.space4)
        .padding(.top, 10)
        .padding(.bottom, Tokens.space3)
        .background(Tokens.brandGradient.ignoresSafeArea(edges: .top))
        // The header stays one size past the largest standard text size, so the screen keeps its room.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .onChange(of: thinking, initial: true) { _, now in
            guard now, !reduceMotion else { return lit = false }
            withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) { lit = true }
        }
    }
}
