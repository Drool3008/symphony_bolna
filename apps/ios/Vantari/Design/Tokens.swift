import SwiftUI
import UIKit

/// Design tokens: the reference simulator's look, adopted by the owner on
/// 2026-10-30 (docs/design-tokens.md, docs/decisions.md). Palette, type and
/// radii read off the reference's tailwind.config.js and src/index.css, with
/// dark values of our own. The web client defines the same names in
/// apps/web/src/styles/tokens.css on its branch; change both together.
enum Tokens {
    // MARK: Colour

    private static func rgb(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }

    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in rgb(traits.userInterfaceStyle == .dark ? dark : light) })
    }

    /// Text.
    static let ink = dynamic(0x0F172A, 0xF1F5F9)
    /// Secondary text, meta, inactive tabs.
    static let muted = dynamic(0x536072, 0xA3AEC0)
    /// Borders, dividers.
    static let line = dynamic(0xE6E8EF, 0x2A3142)
    /// Screen background.
    static let surface = dynamic(0xF7F7FB, 0x0B1020)
    /// Cards, bars, the agent's bubbles. The type token of the same name is `Fonts.card`.
    static let card = dynamic(0xFFFFFF, 0x151B2E)
    /// Progress track, neutral chips.
    static let secondary = dynamic(0xF1F2F7, 0x222A3D)
    /// App chrome: the active tab pill, links, the send button.
    static let stage = dynamic(0x4338CA, 0x818CF8)
    static let stageBg = dynamic(0xEEF2FF, 0x1E1B4B)
    /// Anything the agent says or does.
    static let ai = dynamic(0x6D28D9, 0xC4B5FD)
    static let aiBg = dynamic(0xF4EFFF, 0x2E1065)
    static let aiSoft = dynamic(0xE9E1FF, 0x3B1F7A)
    static let aiDeep = dynamic(0x4C1D95, 0xDDD6FE)
    /// A person deciding: open cards, waiting strips.
    static let human = dynamic(0xB45309, 0xFBBF24)
    static let humanBg = dynamic(0xFFF6E5, 0x3A2508)
    static let humanSoft = dynamic(0xFDE7C3, 0x5A3A0C)
    /// Urgent, low stock, overdue, badges.
    static let decision = dynamic(0xC81E1E, 0xF87171)
    static let decisionBg = dynamic(0xFEF2F2, 0x3B1212)
    /// Enough stock, approved.
    static let ok = dynamic(0x15803D, 0x4ADE80)
    static let okBg = dynamic(0xF0FDF4, 0x0F2E1A)
    /// The chat's wall, under a faint dot grid.
    static let chatWall = dynamic(0xEFEAE2, 0x12161F)
    /// The member's own bubbles.
    static let chatMine = dynamic(0xD9FDD3, 0x1F3B2A)
    /// Text on filled `stage`, `human` and `decision`.
    static let onStrong = dynamic(0xFFFFFF, 0x0F172A)
    /// The brand gradient (135°): violet, indigo at 48%, teal. The same in both modes.
    static let brand1 = dynamic(0x6D28D9, 0x6D28D9)
    static let brand2 = dynamic(0x4F46E5, 0x4F46E5)
    static let brand3 = dynamic(0x0EA5A4, 0x0EA5A4)
    /// Text and icons on the brand gradient.
    static let onBrand = dynamic(0xFFFFFF, 0xFFFFFF)

    /// The brand gradient, as tailwind.config.js `bg-brand` draws it.
    static let brandGradient = LinearGradient(
        stops: [
            .init(color: brand1, location: 0),
            .init(color: brand2, location: 0.48),
            .init(color: brand3, location: 1),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    // MARK: Type (Dynamic Type text styles; docs/design-tokens.md maps each)

    enum Fonts {
        /// Big figures: a card's amount.
        static let app = Font.title.bold()
        /// Sheet and screen titles.
        static let pane = Font.title3.weight(.semibold)
        /// The product's name in the header.
        static let brand = Font.title3.weight(.heavy)
        /// Medicine and test names, card titles.
        static let card = Font.headline
        /// Messages, the latest word.
        static let body = Font.body
        /// Dates, strength, chips, tab labels.
        static let meta = Font.subheadline.weight(.medium)
        /// The AI and Human tags, the "Vantari · AI" label.
        static let badge = Font.caption.bold()
    }

    /// Line spacing added to Telugu, which needs more room than Latin
    /// (`leading-telugu`, 1.7 on the web; Dynamic Type sets line height per style).
    static let teluguLineSpacing: CGFloat = 6

    // MARK: Shape and space, in points

    static let radiusCard: CGFloat = 16
    static let radiusControl: CGFloat = 12
    static let radiusPill: CGFloat = 999
    static let radiusTail: CGFloat = 6
    static let space1: CGFloat = 4
    static let space2: CGFloat = 8
    static let space3: CGFloat = 12
    static let space4: CGFloat = 16
    static let space5: CGFloat = 20
    static let touch: CGFloat = 44

    /// Every token by its name in docs/design-tokens.md, so a test can hold this file to the document.
    static let names: Set<String> = [
        "ink", "muted", "line", "surface", "card", "secondary", "stage", "stage-bg",
        "ai", "ai-bg", "ai-soft", "ai-deep", "human", "human-bg", "human-soft",
        "decision", "decision-bg", "ok", "ok-bg", "chat-wall", "chat-mine", "on-strong",
        "brand-1", "brand-2", "brand-3", "on-brand",
        "app", "pane", "brand", "body", "meta", "badge", "leading-telugu",
        "radius-card", "radius-control", "radius-pill", "radius-tail",
        "space-1", "space-2", "space-3", "space-4", "space-5", "touch",
    ]
}

extension Strings {
    /// Line spacing for text in this member's language: Telugu needs more room.
    var lineSpacing: CGFloat { isTelugu ? Tokens.teluguLineSpacing : 0 }
}

/// Line spacing for text in a language named only by its own tag, such as a
/// message the agent wrote in Telugu to a member who reads English.
func lineSpacing(forLanguage language: String?) -> CGFloat {
    (language ?? "").lowercased().hasPrefix("te") ? Tokens.teluguLineSpacing : 0
}

/// The reference's shadows (tailwind.config.js `shadow-card`, `shadow-bubble`).
/// Dark mode draws no shadow; a `line` border shows the edge instead.
private struct Raised: ViewModifier {
    let bubble: Bool
    let radius: CGFloat
    @Environment(\.colorScheme) private var scheme
    private static let slate = Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)

    func body(content: Content) -> some View {
        if scheme == .dark {
            // A bubble draws its own border; a card gets one here.
            if bubble {
                content
            } else {
                content.overlay { RoundedRectangle(cornerRadius: radius).strokeBorder(Tokens.line, lineWidth: 1) }
            }
        } else if bubble {
            content.shadow(color: Self.slate.opacity(0.13), radius: 0.75, y: 1)
        } else {
            content
                .shadow(color: Self.slate.opacity(0.06), radius: 1, y: 1)
                .shadow(color: Self.slate.opacity(0.06), radius: 7, y: 4)
        }
    }
}

extension View {
    /// A card's shadow in light mode, a thin border in dark.
    func cardShadow(radius: CGFloat = Tokens.radiusCard) -> some View {
        modifier(Raised(bubble: false, radius: radius))
    }

    /// A chat bubble's shadow in light mode; none in dark, where the bubble's own border shows its edge.
    func bubbleShadow() -> some View {
        modifier(Raised(bubble: true, radius: Tokens.radiusCard))
    }
}
