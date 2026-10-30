import SwiftUI

@main
struct VantariApp: App {
    @State private var model = AppModel()
    @State private var family: FamilyStore
    @State private var homes = HomeStore()
    @State private var threads = AgentThreadStore()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Before the family store reads who this phone belongs to.
        Identity().takeLaunchArgument()
        _family = State(initialValue: FamilyStore())
    }

    var body: some Scene {
        WindowGroup {
            RootView(family: family)
                .environment(model)
                .environment(homes)
                .environment(threads)
                .task {
                    model.register(family)
                    model.register(homes)
                    model.register(threads)
                    model.connect()
                    await family.load()
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.returnedToForeground() }
        }
    }
}

/// The picker until a member is chosen; after that, the member's app.
struct RootView: View {
    let family: FamilyStore

    var body: some View {
        if let me = family.me {
            MemberShell(me: me, others: family.members.filter { $0.id != me.id })
        } else if family.memberId == nil || !family.members.isEmpty {
            PickerView(family: family)
        } else {
            Tokens.surface.ignoresSafeArea()
        }
    }
}
