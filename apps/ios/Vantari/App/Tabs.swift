/// The member's tabs (brief, Stage I2). The same list as the web client's
/// apps/web/src/app/tabs.ts: the wallet is the responsible person's only, and
/// stays hidden for everyone until the wallet routes exist (HANDOFF.md
/// section 11, planned).
enum TabID: String, CaseIterable, Sendable {
    case home, agent, family, wallet
}

struct AppTab: Identifiable, Equatable, Sendable {
    let id: TabID
    let label: StringKey
    /// The tab bar's symbol (a proposal; the web's tabs are words alone).
    let symbol: String
    /// Only this role sees the tab.
    var role: Role?
    /// False until the backend serves what the tab shows.
    var available: Bool

    static let all: [AppTab] = [
        AppTab(id: .home, label: .tabHome, symbol: "house", available: true),
        AppTab(id: .agent, label: .tabAgent, symbol: "bubble.left", available: true),
        AppTab(id: .family, label: .tabFamily, symbol: "person.2", available: true),
        AppTab(id: .wallet, label: .tabWallet, symbol: "wallet.pass", role: .responsiblePerson, available: false),
    ]

    static func tabs(for role: Role, from tabs: [AppTab] = all) -> [AppTab] {
        tabs.filter { $0.available && ($0.role == nil || $0.role == role) }
    }
}
