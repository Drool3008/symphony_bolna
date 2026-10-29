import Testing
@testable import Vantari

/// The same checks as the web client's apps/web/src/app/tabs.test.ts.
@Suite("The tabs")
struct TabsTests {
    @Test func givesEveryMemberHomeChatAndFamilyAndNobodyTheWalletWhileItsRoutesAreMissing() {
        for role in [Role.patient, .responsiblePerson, .family] {
            #expect(AppTab.tabs(for: role).map(\.id) == [.home, .agent, .family])
        }
    }

    @Test func keepsTheWalletForTheResponsiblePersonOnceItIsAvailable() {
        let later = AppTab.all.map { tab in
            var tab = tab
            if tab.id == .wallet { tab.available = true }
            return tab
        }
        #expect(AppTab.tabs(for: .responsiblePerson, from: later).map(\.id).contains(.wallet))
        #expect(!AppTab.tabs(for: .patient, from: later).map(\.id).contains(.wallet))
        #expect(!AppTab.tabs(for: .family, from: later).map(\.id).contains(.wallet))
    }

    @Test func callsTheAgentTabChatAsTheReferenceDid() {
        let agent = AppTab.all.first { $0.id == .agent }
        #expect(agent?.label == .tabAgent)
        #expect(Strings(language: "en-IN").t(.tabAgent) == "Chat")
    }
}
