import Foundation

/// The answers scripts/record-fixtures.mjs recorded from a real stub server.
enum Fixtures {
    private final class Token {}

    static let directory: URL = {
        guard let url = Bundle(for: Token.self).url(forResource: "Fixtures", withExtension: nil) else {
            fatalError("Tests/Fixtures is not in the test bundle; check project.yml")
        }
        return url
    }()

    static func data(_ name: String) throws -> Data {
        try Data(contentsOf: directory.appending(path: name))
    }

    static var names: [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
    }
}
