import SwiftUI

/// The member's app, laid out as the reference's PhoneApp (src/PhoneApp.tsx):
/// the gradient header with what the agent is doing, the open tab, and the
/// tab bar. Their language comes from onboarding, never the device.
struct MemberShell: View {
    let me: MemberSummary
    /// The rest of the family, in onboarding order.
    let others: [MemberSummary]
    @Environment(AppModel.self) private var model
    @State private var tab: TabID

    /// `-tab agent` (UserDefaults' argument domain) opens on a given tab, for screenshots and UI tests.
    static let launchTabKey = "tab"

    init(me: MemberSummary, others: [MemberSummary]) {
        self.me = me
        self.others = others
        let asked = UserDefaults.standard.string(forKey: Self.launchTabKey).flatMap(TabID.init(rawValue:))
        let tabs = AppTab.tabs(for: me.role).map(\.id)
        _tab = State(initialValue: asked.flatMap { tabs.contains($0) ? $0 : nil } ?? .home)
    }

    var body: some View {
        let s = Strings(language: me.language)
        VStack(spacing: 0) {
            ShellHeader(
                me: me, s: s,
                clock: model.session.clock,
                stage: model.session.generation == nil ? nil : model.session.stage,
                thinking: model.session.thinking
            )
            if model.session.connection == .offline {
                Text(s.t(.offline))
                    .font(Tokens.Fonts.meta).bold()
                    .foregroundStyle(Tokens.decision)
                    .lineSpacing(s.lineSpacing)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Tokens.space4)
                    .padding(.vertical, Tokens.space2)
                    .background(Tokens.decisionBg)
                    .accessibilityIdentifier("offline")
            }
            screen(tab, s)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Tokens.surface)
            TabBar(tabs: AppTab.tabs(for: me.role), selection: $tab, s: s)
        }
        .background(Tokens.surface)
        .environment(\.locale, s.locale)
    }

    @ViewBuilder
    private func screen(_ id: TabID, _ s: Strings) -> some View {
        switch id {
        case .home:
            HomeScreen(me: me, others: others, s: s)
        case .agent:
            Tokens.surface
        case .family:
            FamilyScreen(s: s)
        case .wallet:
            // Never listed until the wallet routes exist.
            EmptyView()
        }
    }
}

/// Waits on the backend's read routes for chats and seeded history
/// (docs/backend-asks.md, ask 1; owner's answer: do not work around it).
/// A centred note on the screen, under the two-people sign of the tab.
struct FamilyScreen: View {
    let s: Strings

    var body: some View {
        VStack(spacing: Tokens.space3) {
            Image(systemName: "person.2")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(Tokens.stage)
                .frame(width: 56, height: 56)
                .background(Tokens.stageBg, in: Circle())
                .accessibilityHidden(true)
            Text(s.t(.familyWaiting))
                .font(Tokens.Fonts.body)
                .foregroundStyle(Tokens.muted)
                .multilineTextAlignment(.center)
                .lineSpacing(s.lineSpacing)
                .accessibilityIdentifier("family-waiting")
        }
        .padding(Tokens.space5)
        .frame(maxWidth: .infinity)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.radiusCard))
        .cardShadow()
        .padding(Tokens.space4)
        .frame(maxHeight: .infinity)
    }
}
