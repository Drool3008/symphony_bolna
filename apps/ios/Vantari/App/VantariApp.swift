import SwiftUI

@main
struct VantariApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// Blank until the design direction is chosen (brief, Section 5). It asks the
/// server for the family once, so a test can tell the backend address works;
/// the answer is exposed to accessibility only, never drawn.
struct RootView: View {
    @State private var reached = "not yet"

    var body: some View {
        Color.clear
            .accessibilityElement()
            .accessibilityIdentifier("backend")
            .accessibilityLabel(reached)
            .task {
                let url = Backend.base.appending(path: "api/members")
                do {
                    let (_, response) = try await URLSession.shared.data(from: url)
                    reached = "status \((response as? HTTPURLResponse)?.statusCode ?? 0)"
                } catch {
                    reached = "unreachable"
                }
            }
    }
}
