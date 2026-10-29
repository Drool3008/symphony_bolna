import SwiftUI

/// Who this phone belongs to. Shown once; after a pick the app is that
/// member's and has no switcher (brief, Section 1: one phone, one person).
/// A development identity: it names the member to the server in X-Member-Id
/// and proves nothing (HANDOFF.md section 7). Forgetting the pick, to see the
/// picker again, means deleting the app or launching it with `-member-id ""`
/// (Identity.takeLaunchArgument).
struct PickerView: View {
    let family: FamilyStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.space2) {
                Text("DEVELOPMENT IDENTITY")
                    .font(Tokens.label).foregroundStyle(Tokens.ink2).tracking(0.8)
                Text("Who is this phone for?").font(Tokens.display)
                Text("Picking a name only tells the family server who is asking. It does not sign anyone in.")
                    .font(Tokens.meta).foregroundStyle(Tokens.ink2)
                    .padding(.bottom, Tokens.space5)
                if let problem = family.problem {
                    Text(problem).font(Tokens.meta).bold().accessibilityIdentifier("problem")
                }
                VStack(spacing: 0) {
                    ForEach(family.members) { member in
                        Button {
                            family.choose(member.id)
                        } label: {
                            Text(member.name)
                                .font(Tokens.title)
                                .foregroundStyle(Tokens.ink)
                                .frame(maxWidth: .infinity, minHeight: Tokens.touch + Tokens.space4, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .overlay(alignment: .bottom) { Rectangle().fill(Tokens.rule).frame(height: Tokens.ruleThin) }
                    }
                }
                .overlay(alignment: .top) { Rectangle().fill(Tokens.ink).frame(height: Tokens.ruleThick) }
            }
            .padding(Tokens.space4)
        }
        .background(Tokens.paper)
    }
}
