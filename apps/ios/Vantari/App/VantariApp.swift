import SwiftUI

@main
struct VantariApp: App {
    @State private var model = AppModel()
    @State private var family: FamilyStore
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
                .task {
                    model.register(family)
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
            MemberView(me: me)
        } else if family.memberId == nil || !family.members.isEmpty {
            PickerView(family: family)
        } else {
            Tokens.paper.ignoresSafeArea()
        }
    }
}

/// The member's app. Their language comes from onboarding, never the device.
struct MemberView: View {
    let me: MemberSummary

    var body: some View {
        let s = Strings(language: me.language)
        VStack(alignment: .leading) {
            Text(me.name).font(Tokens.display).accessibilityIdentifier("member-name")
            Spacer()
        }
        .padding(Tokens.space4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.paper)
        .environment(\.locale, s.locale)
    }
}
