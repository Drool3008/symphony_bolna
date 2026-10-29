import XCTest

/// The backend's dev routes, for UI tests only (brief, Section 7: never from
/// the app). The Makefile starts a backend of its own for the tests and passes
/// its address as TEST_RUNNER_API_BASE.
struct DevRoutes {
    let base: String

    static var testBackend: DevRoutes {
        DevRoutes(base: ProcessInfo.processInfo.environment["API_BASE"] ?? "http://localhost:8799")
    }

    @discardableResult
    func call(_ method: String, _ path: String, member: String? = nil, body: [String: Any]? = nil) async throws -> Any {
        var request = URLRequest(url: URL(string: base + path)!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let member { request.setValue(member, forHTTPHeaderField: "X-Member-Id") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = try JSONSerialization.jsonObject(with: data)
        guard (200..<300).contains(status) else {
            throw NSError(domain: "DevRoutes", code: status, userInfo: [NSLocalizedDescriptionKey: "\(path): \(json)"])
        }
        return json
    }

    /// A new run: the clock back at its start, every thread empty.
    func reset() async throws {
        try await call("POST", "/api/reset", body: ["reason": "UI test"])
    }

    func moveClock(to time: String) async throws {
        try await call("POST", "/api/clock", body: ["to": time, "source": "UI test"])
    }

    func moveClockToNextDate() async throws {
        try await call("POST", "/api/clock", body: ["to_next_date": true, "source": "UI test: the refill check"])
    }

    /// Waits for the next call on the operator queue and answers it with an answer on file.
    func answerNextCall(variant: String) async throws {
        for _ in 0..<200 {
            let queue = try await call("GET", "/api/operator/queue") as? [String: Any]
            if let item = (queue?["pending"] as? [[String: Any]])?.first, let id = item["id"] as? String {
                try await call("POST", "/api/operator/queue/\(id)", body: ["variant": variant])
                return
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTFail("no call reached the operator queue")
    }
}
