import SwiftUI

/// The member's app: their name and the family's date on top, the tabs below
/// (as the web client's apps/web/src/app/Shell.tsx). Their language comes
/// from onboarding, never the device.
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
            ShellHeader(me: me, s: s, clock: model.session.clock)
            if model.session.connection == .offline {
                Text(s.t(.offline))
                    .font(Tokens.meta).bold()
                    .lineSpacing(s.lineSpacing)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Tokens.space4)
                    .padding(.vertical, Tokens.space2)
                    .accessibilityIdentifier("offline")
            }
            TabView(selection: $tab) {
                ForEach(AppTab.tabs(for: me.role)) { item in
                    screen(item.id, s)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .background(Tokens.paper)
                        .tabItem { Label(s.t(item.label), systemImage: item.symbol) }
                        .tag(item.id)
                }
            }
            .tint(Tokens.ink)
        }
        .background(Tokens.paper)
        .environment(\.locale, s.locale)
    }

    @ViewBuilder
    private func screen(_ id: TabID, _ s: Strings) -> some View {
        switch id {
        case .home:
            HomeScreen(me: me, others: others, s: s)
        case .agent:
            Tokens.paper
        case .family:
            FamilyScreen(s: s)
        case .wallet:
            // Never listed until the wallet routes exist.
            EmptyView()
        }
    }
}

/// The member's name and the family's date, on the sim clock.
struct ShellHeader: View {
    let me: MemberSummary
    let s: Strings
    let clock: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.space1) {
            Text(me.name)
                .font(Tokens.display)
                .foregroundStyle(Tokens.ink)
                .accessibilityIdentifier("member-name")
            if let clock {
                Text(s.longDate(clock))
                    .font(Tokens.meta)
                    .foregroundStyle(Tokens.ink2)
                    .lineSpacing(s.lineSpacing)
                    .accessibilityIdentifier("family-date")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Tokens.space4)
        .padding(.top, Tokens.space2)
        .padding(.bottom, Tokens.space3)
        .overlay(alignment: .bottom) { Rectangle().fill(Tokens.ink).frame(height: Tokens.ruleThick) }
    }
}

/// Waits on the backend's read routes for chats and seeded history
/// (docs/backend-asks.md, ask 1; owner's answer: do not work around it).
struct FamilyScreen: View {
    let s: Strings

    var body: some View {
        Text(s.t(.familyWaiting))
            .font(Tokens.body)
            .foregroundStyle(Tokens.ink2)
            .lineSpacing(s.lineSpacing)
            .padding(Tokens.space4)
            .accessibilityIdentifier("family-waiting")
    }
}
