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
                do {
                    reached = "members \(try await APIClient().members().members.count)"
                } catch let error as APIError {
                    reached = error.message
                } catch {
                    reached = "unreadable"
                }
            }
    }
}
