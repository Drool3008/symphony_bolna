import Foundation
import Testing
@testable import Vantari

@MainActor
final class CountingStore: RunScopedStore {
    var cleared = 0
    var refetched = 0
    var shown: [String] = ["from the last run"]

    func clear() {
        cleared += 1
        shown = []
    }

    func refetch() async {
        refetched += 1
    }
}

@MainActor
@Suite("The stream feeding the stores")
struct AppModelTests {
    func event(_ json: String) throws -> StreamEvent {
        try JSONDecoder().decode(StreamEvent.self, from: Data(json.utf8))
    }

    func sync(_ generation: Int) throws -> StreamEvent {
        try event(#"{"type":"sync","at":"w","clock":"2026-10-06T03:42:00.000Z","stage":1,"generation":\#(generation)}"#)
    }

    @Test func keepsTheSimClockAndStage() throws {
        let model = AppModel()
        model.apply(try sync(1))
        model.apply(try event(#"{"seq":2,"type":"clock","at":"w","clock":"2026-10-08T18:30:00.000Z","source":"s","reached":[]}"#))
        model.apply(try event(#"{"seq":3,"type":"stage","at":"w","clock":"c","stage":6,"why":"acting"}"#))
        #expect(model.session.clock == "2026-10-08T18:30:00.000Z")
        #expect(model.session.stage == 6)
        #expect(model.session.generation == 1)
    }

    @Test func clearsEveryStoreOnAResetAndReadsAgain() async throws {
        let model = AppModel()
        let home = CountingStore()
        let thread = CountingStore()
        model.register(home)
        model.register(thread)
        model.apply(try sync(1))
        model.apply(try event(#"{"seq":9,"type":"reset","at":"w","clock":"2026-10-06T03:42:00.000Z","reason":"operator reset"}"#))
        #expect(home.shown.isEmpty && thread.shown.isEmpty)
        #expect(model.session.generation == 2)
        for _ in 0..<50 where home.refetched == 0 || thread.refetched == 0 { await Task.yield() }
        #expect(home.refetched == 1 && thread.refetched == 1)
    }

    @Test func treatsASyncFromAnotherGenerationAsANewRun() throws {
        let model = AppModel()
        let store = CountingStore()
        model.register(store)
        model.apply(try sync(1))
        model.apply(try sync(1))
        #expect(store.cleared == 0)
        model.apply(try sync(3))
        #expect(store.cleared == 1)
        #expect(model.session.generation == 3)
    }
}
