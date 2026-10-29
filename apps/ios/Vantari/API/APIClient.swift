import Foundation

/// A request that did not get a usable answer.
enum APIError: Error, Equatable, Sendable {
    /// The server said no, in its own words (server/src/http.ts sends `{ error }`).
    case refused(status: Int, reason: String)
    /// The server was not reached at all.
    case offline

    /// What to show a person.
    var message: String {
        switch self {
        case let .refused(_, reason): reason
        case .offline: "The app cannot reach the family's server right now."
        }
    }
}

/// The app's one client for every request (brief, Section 4). Who is asking is
/// read from `Identity` on each request and nowhere else.
actor APIClient {
    private let base: URL
    private let session: URLSession
    private let identity: Identity
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(base: URL = Backend.base, session: URLSession = .shared, identity: Identity = Identity()) {
        self.base = base
        self.session = session
        self.identity = identity
    }

    func members() async throws -> MembersResponse {
        try await send("GET", "api/members")
    }

    func home(_ memberId: String) async throws -> MemberHomeResponse {
        try await send("GET", "api/members/\(memberId)/home")
    }

    func input(_ body: InputRequest) async throws -> InputResponse {
        try await send("POST", "api/input", body: body)
    }

    func reply(_ body: ReplyRequest) async throws -> ReplyResponse {
        try await send("POST", "api/reply", body: body)
    }

    func chatSend(_ body: ChatSendRequest) async throws -> ChatSendResponse {
        try await send("POST", "api/chat/send", body: body)
    }

    func forward(_ body: ForwardRequest) async throws -> ForwardResponse {
        try await send("POST", "api/forward", body: body)
    }

    private struct Empty: Encodable {}

    private func send<Response: Decodable>(_ method: String, _ path: String) async throws -> Response {
        try await send(method, path, body: Empty?.none)
    }

    private func send<Body: Encodable, Response: Decodable>(
        _ method: String, _ path: String, body: Body?
    ) async throws -> Response {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        for (name, value) in identity.headers {
            request.setValue(value, forHTTPHeaderField: name)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let reason = (try? decoder.decode(ErrorBody.self, from: data))?.error
            throw APIError.refused(status: status, reason: reason ?? "The server answered \(status).")
        }
        return try decoder.decode(Response.self, from: data)
    }
}
