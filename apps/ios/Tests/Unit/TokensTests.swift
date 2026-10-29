import Foundation
import Testing
@testable import Vantari

@Suite("Design tokens")
struct TokensTests {
    private final class Token {}

    /// The token names in the first column of each table in docs/design-tokens.md.
    func documented() throws -> Set<String> {
        let url = try #require(Bundle(for: Token.self).url(forResource: "design-tokens", withExtension: "md"))
        let text = try String(contentsOf: url, encoding: .utf8)
        let pattern = try NSRegularExpression(pattern: "^\\| `([a-z0-9-]+)` *\\|", options: .anchorsMatchLines)
        let matches = pattern.matches(in: text, range: NSRange(text.startIndex..., in: text))
        return Set(matches.compactMap { Range($0.range(at: 1), in: text).map { String(text[$0]) } })
    }

    @Test func definesEveryTokenTheDesignDocumentNames() throws {
        let names = try documented()
        #expect(names.count > 15)
        #expect(names.subtracting(Tokens.names).isEmpty, "missing from Tokens.swift: \(names.subtracting(Tokens.names))")
    }

    @Test func keepsTheSizesTheDocumentGives() {
        #expect(Tokens.touch == 48 && Tokens.space4 == 16 && Tokens.bar == 4 && Tokens.figureSize == 44)
    }
}
