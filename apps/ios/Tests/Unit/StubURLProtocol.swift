import Foundation

/// Answers URLSession requests in tests without a network.
final class StubURLProtocol: URLProtocol {
    struct Answer: Sendable {
        var status = 200
        var body = Data()
        var fail: URLError.Code?
    }

    nonisolated(unsafe) static var answer = Answer()
    nonisolated(unsafe) static var seen: [URLRequest] = []

    static func session() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        var request = request
        if request.httpBody == nil, let stream = request.httpBodyStream {
            request.httpBody = Data(reading: stream)
        }
        Self.seen.append(request)
        if let fail = Self.answer.fail {
            client?.urlProtocol(self, didFailWithError: URLError(fail))
            return
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.answer.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.answer.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

extension Data {
    init(reading stream: InputStream) {
        self.init()
        stream.open()
        defer { stream.close() }
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            append(buffer, count: count)
        }
    }
}
