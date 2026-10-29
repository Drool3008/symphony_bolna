import SwiftUI

@main
struct VantariApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// Blank until the design direction is chosen (brief, Section 5).
struct RootView: View {
    var body: some View {
        Color.clear
            .accessibilityIdentifier("root")
    }
}
