import Foundation

/// Answers URLSession requests by path, from bodies a test sets, and keeps
/// every request. Each test makes its own `Book` with its own host, so suites
/// running side by side never share answers.
final class PathStubProtocol: URLProtocol {
    final class Book: @unchecked Sendable {
        /// The base URL to give the client under test; its host names this book.
        let base: URL
        let session: URLSession
        private let lock = NSLock()
        private var bodies: [String: (status: Int, body: Data)] = [:]
        private var seen: [URLRequest] = []

        init() {
            let host = "stub-\(UUID().uuidString.lowercased()).test"
            base = URL(string: "http://\(host)")!
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [PathStubProtocol.self]
            session = URLSession(configuration: config)
            PathStubProtocol.lock.withLock { PathStubProtocol.books[host] = self }
        }

        func answer(_ path: String, status: Int = 200, _ body: Data) {
            lock.withLock { bodies[path] = (status, body) }
        }

        var requests: [URLRequest] { lock.withLock { seen } }

        func paths() -> [String] { requests.compactMap { $0.url?.path } }

        fileprivate func take(_ request: URLRequest) -> (status: Int, body: Data)? {
            lock.withLock {
                seen.append(request)
                return bodies[request.url?.path ?? ""]
            }
        }
    }

    nonisolated(unsafe) fileprivate static var books: [String: Book] = [:]
    fileprivate static let lock = NSLock()

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let book = Self.lock.withLock { Self.books[request.url?.host ?? ""] }
        guard let answer = book?.take(request) else {
            client?.urlProtocol(self, didFailWithError: URLError(.cannotConnectToHost))
            return
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: answer.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: answer.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
