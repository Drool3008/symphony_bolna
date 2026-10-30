import SwiftUI

// Who is who, at a glance (the reference's rule, in
// ../super-duper-engine-reference/src/components/brand.tsx): the agent is
// violet, with a sparkle, on the brand gradient, and says it is AI; people are
// flat colour with their initials; a person deciding is amber. Drawn here in
// SwiftUI from that file's description, not copied from it.

/// The product's mark: a care shield with a pulse line on the brand gradient,
/// and a small amber dot at the top right. Drawn on a 40-point grid and scaled.
struct LogoMark: View {
    var size: CGFloat = 32

    /// The mark's own gradient and dot, which brand.tsx gives apart from the
    /// header's gradient (a lighter violet at the start).
    private static let start = Color(red: 0x7C / 255, green: 0x3A / 255, blue: 0xED / 255)
    private static let dot = Color(red: 0xFD / 255, green: 0xE6 / 255, blue: 0x8A / 255)

    var body: some View {
        Canvas { context, canvas in
            let k = canvas.width / 40
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * k, y: y * k) }

            let tile = Path(roundedRect: CGRect(x: 0, y: 0, width: 40 * k, height: 40 * k), cornerRadius: 11 * k)
            context.fill(tile, with: .linearGradient(
                Gradient(stops: [
                    .init(color: Self.start, location: 0),
                    .init(color: Tokens.brand2, location: 0.5),
                    .init(color: Tokens.brand3, location: 1),
                ]),
                startPoint: p(0, 0), endPoint: p(40, 40)
            ))

            // The shield: a peak at the top, straight shoulders, sides curving to a point.
            var shield = Path()
            shield.move(to: p(20, 8.5))
            shield.addLine(to: p(11, 12.3))
            shield.addLine(to: p(11, 18.7))
            shield.addCurve(to: p(20, 30.5), control1: p(11, 24.3), control2: p(14.8, 29.1))
            shield.addCurve(to: p(29, 18.7), control1: p(25.2, 29.1), control2: p(29, 24.3))
            shield.addLine(to: p(29, 12.3))
            shield.closeSubpath()
            context.fill(shield, with: .color(.white.opacity(0.18)))
            context.stroke(shield, with: .color(.white), style: StrokeStyle(lineWidth: 1.8 * k, lineJoin: .round))

            // The pulse across it.
            var pulse = Path()
            pulse.move(to: p(13.6, 20))
            pulse.addLine(to: p(17.2, 20))
            pulse.addLine(to: p(18.9, 16.4))
            pulse.addLine(to: p(21.5, 23.6))
            pulse.addLine(to: p(23.3, 20))
            pulse.addLine(to: p(26.4, 20))
            context.stroke(pulse, with: .color(.white), style: StrokeStyle(lineWidth: 2 * k, lineCap: .round, lineJoin: .round))

            let dot = Path(ellipseIn: CGRect(x: (30.5 - 3.2) * k, y: (9.5 - 3.2) * k, width: 6.4 * k, height: 6.4 * k))
            context.fill(dot, with: .color(Self.dot))
            context.stroke(dot, with: .color(.white), lineWidth: 1.4 * k)
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel(Product.name)
        .accessibilityAddTraits(.isImage)
    }
}

/// A four-pointed sparkle, the agent's sign in the header's status line.
struct Sparkle: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let r = min(rect.width, rect.height) / 2
        let waist = r * 0.36
        var path = Path()
        path.move(to: CGPoint(x: c.x, y: c.y - r))
        path.addLine(to: CGPoint(x: c.x + waist * 0.55, y: c.y - waist * 0.55))
        path.addLine(to: CGPoint(x: c.x + r, y: c.y))
        path.addLine(to: CGPoint(x: c.x + waist * 0.55, y: c.y + waist * 0.55))
        path.addLine(to: CGPoint(x: c.x, y: c.y + r))
        path.addLine(to: CGPoint(x: c.x - waist * 0.55, y: c.y + waist * 0.55))
        path.addLine(to: CGPoint(x: c.x - r, y: c.y))
        path.addLine(to: CGPoint(x: c.x - waist * 0.55, y: c.y - waist * 0.55))
        path.closeSubpath()
        return path
    }
}

/// The agent's face: the brand gradient, a sparkle, and a soft violet ring so
/// it never reads as a person.
struct AgentAvatar: View {
    var size: CGFloat = 40

    var body: some View {
        Circle()
            .fill(Tokens.brandGradient)
            .overlay {
                Image(systemName: "sparkles")
                    .font(.system(size: size * 0.48, weight: .semibold))
                    .foregroundStyle(Tokens.onBrand)
            }
            .frame(width: size, height: size)
            .padding(1)
            .overlay { Circle().strokeBorder(Tokens.aiSoft, lineWidth: 2) }
            .accessibilityHidden(true)
    }
}

/// A person: flat colour and initials, never a sparkle.
struct PersonAvatar: View {
    let name: String
    var size: CGFloat = 40

    /// brand.tsx's six tones, picked by the sum of the name's character codes.
    static let tones: [UInt32] = [0x0F766E, 0xB45309, 0xBE185D, 0x1D4ED8, 0x7C2D12, 0x15803D]

    static func toneIndex(_ name: String) -> Int {
        name.unicodeScalars.reduce(0) { $0 + Int($1.value) } % tones.count
    }

    static func initials(_ name: String) -> String {
        name.split(whereSeparator: \.isWhitespace).prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    var body: some View {
        let hex = Self.tones[Self.toneIndex(name)]
        Circle()
            .fill(Tokens.dynamic(hex, hex))
            .overlay {
                Text(Self.initials(name))
                    .font(.system(size: size * 0.36, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The "AI" chip, for anything the model produced.
struct AITag: View {
    var label = "AI"

    var body: some View {
        HStack(spacing: Tokens.space1) {
            Image(systemName: "sparkles").imageScale(.small).accessibilityHidden(true)
            Text(label)
        }
        .font(Tokens.Fonts.badge)
        .foregroundStyle(Tokens.aiDeep)
        .padding(.horizontal, Tokens.space2)
        .padding(.vertical, 2)
        .background(Tokens.aiSoft, in: Capsule())
        .fixedSize()
    }
}

/// The "Human" chip, for a person's decision or words.
struct HumanTag: View {
    let label: String

    /// brand.tsx sets the tag's text darker than `human`, for contrast on `human-soft`.
    private static let text = Tokens.dynamic(0x7C3A06, 0xFDE7C3)

    var body: some View {
        HStack(spacing: Tokens.space1) {
            Image(systemName: "person.fill").imageScale(.small).accessibilityHidden(true)
            Text(label)
        }
        .font(Tokens.Fonts.badge)
        .foregroundStyle(Self.text)
        .padding(.horizontal, Tokens.space2)
        .padding(.vertical, 2)
        .background(Tokens.humanSoft, in: Capsule())
        .fixedSize()
    }
}
