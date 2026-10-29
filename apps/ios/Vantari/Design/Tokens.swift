import SwiftUI
import UIKit

/// Design tokens for direction A, "Plain page" (docs/design-tokens.md). The
/// web client defines the same names in apps/web/src/styles/tokens.css on its
/// branch; change both together.
enum Tokens {
    // MARK: Colour

    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }

    static let ink = dynamic(0x111111, 0xF2F2F2)
    static let ink2 = dynamic(0x4A4A4A, 0xB5B5B5)
    static let rule = dynamic(0xD6D6D6, 0x3A3A3A)
    static let paper = dynamic(0xFFFFFF, 0x111111)
    static let wash = dynamic(0xF2F2F2, 0x1E1E1E)
    /// Only "needs your answer".
    static let accent = dynamic(0xB34700, 0xFF9E59)
    static let onAccent = dynamic(0xFFFFFF, 0x111111)

    // MARK: Type (Dynamic Type text styles; docs/design-tokens.md maps each)

    static let display = Font.largeTitle.bold()
    static let title = Font.title3.weight(.semibold)
    static let body = Font.body
    static let meta = Font.callout
    static let label = Font.footnote.weight(.semibold)
    /// Days of cover: 44pt that scales with Body. Use with `@ScaledMetric`.
    static let figureSize: CGFloat = 44

    /// Line spacing added for Telugu, which needs more room than Latin
    /// (leading 1.7 against 1.45 on the web).
    static let teluguLineSpacing: CGFloat = 5

    // MARK: Space and size, in points

    static let space1: CGFloat = 4
    static let space2: CGFloat = 8
    static let space3: CGFloat = 12
    static let space4: CGFloat = 16
    static let space5: CGFloat = 24
    static let touch: CGFloat = 48
    static let ruleThin: CGFloat = 1
    static let ruleThick: CGFloat = 2
    static let bar: CGFloat = 4

    /// Every token by its name in docs/design-tokens.md, so a test can hold this file to the document.
    static let names: Set<String> = [
        "ink", "ink-2", "rule", "paper", "wash", "accent", "on-accent",
        "display", "figure", "title", "body", "meta", "label", "leading", "leading-telugu",
        "space-1", "space-2", "space-3", "space-4", "space-5", "touch", "rule-thin", "rule-thick", "bar",
    ]
}

extension Strings {
    /// Line spacing for text in this member's language: Telugu needs more room.
    var lineSpacing: CGFloat { isTelugu ? Tokens.teluguLineSpacing : 0 }
}

extension View {
    /// The bar down the left of whatever the agent said, so it reads as the
    /// agent's without a label (docs/design-tokens.md, `bar`).
    func agentBar() -> some View {
        padding(.leading, Tokens.space3)
            .overlay(alignment: .leading) { Rectangle().fill(Tokens.ink).frame(width: Tokens.bar) }
    }
}
