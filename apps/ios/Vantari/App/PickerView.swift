import SwiftUI

/// Who this phone belongs to. Shown once; after a pick the app is that
/// member's and has no switcher (brief, Section 1: one phone, one person).
/// A development identity: it names the member to the server in X-Member-Id
/// and proves nothing (HANDOFF.md section 7). Forgetting the pick, to see the
/// picker again, means deleting the app or launching it with `-member-id ""`
/// (Identity.takeLaunchArgument).
///
/// Laid out as the reference's picker (UI Components/20-phone-picker.png,
/// src/main.tsx): the mark and the name on top, then one card per member with
/// their avatar, name and role. English only: nobody's language is known yet.
struct PickerView: View {
    let family: FamilyStore

    /// The role under each name, in the reference's words (src/main.tsx).
    static func roleLine(_ role: Role) -> String {
        switch role {
        case .patient: "Patient"
        case .responsiblePerson: "Manages the family health and the wallet"
        case .family: "Family member"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.space3) {
                HStack(spacing: Tokens.space3) {
                    LogoMark(size: 40)
                    Text(Product.name)
                        .font(.largeTitle.weight(.heavy))
                        .foregroundStyle(Tokens.stage)
                }
                Text("DEVELOPMENT IDENTITY")
                    .font(Tokens.Fonts.badge).foregroundStyle(Tokens.muted).tracking(0.8)
                    .padding(.top, Tokens.space2)
                Text("Who is this phone for?")
                    .font(Tokens.Fonts.pane).foregroundStyle(Tokens.ink)
                Text("Picking a name only tells the family server who is asking. It does not sign anyone in.")
                    .font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
                    .padding(.bottom, Tokens.space2)
                if let problem = family.problem {
                    Text(problem)
                        .font(Tokens.Fonts.meta).bold()
                        .foregroundStyle(Tokens.decision)
                        .accessibilityIdentifier("problem")
                }
                ForEach(family.members) { member in
                    Button {
                        family.choose(member.id)
                    } label: {
                        HStack(spacing: Tokens.space4) {
                            PersonAvatar(name: member.name, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(member.name).font(Tokens.Fonts.card).foregroundStyle(Tokens.ink)
                                Text(Self.roleLine(member.role)).font(Tokens.Fonts.meta).foregroundStyle(Tokens.muted)
                            }
                            .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .padding(Tokens.space4)
                        .frame(maxWidth: .infinity, minHeight: Tokens.touch, alignment: .leading)
                        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
                        .overlay { RoundedRectangle(cornerRadius: Tokens.radiusCard).strokeBorder(Tokens.line, lineWidth: 1) }
                        .contentShape(RoundedRectangle(cornerRadius: Tokens.radiusCard))
                    }
                    .buttonStyle(.plain)
                    // The name alone, so the pick reads (and is found) by the name; the role is its value.
                    .accessibilityLabel(member.name)
                    .accessibilityValue(Self.roleLine(member.role))
                }
            }
            .padding(Tokens.space4)
        }
        .background(Tokens.surface)
    }
}
