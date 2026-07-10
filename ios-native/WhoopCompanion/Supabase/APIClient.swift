import Foundation

/// Calls TanStack server functions and the /api/chat SSE endpoint hosted on the web app.
enum APIError: Error { case badResponse(Int, String), notAuthenticated, decoding(Error) }

struct APIClient {
    static let shared = APIClient()

    /// POST JSON to a TanStack server function.
    func callServerFn<Response: Decodable, Body: Encodable>(
        name: String,
        body: Body,
        as: Response.Type = Response.self
    ) async throws -> Response {
        let url = Config.apiBaseURL.appendingPathComponent("_serverFn").appendingPathComponent(name)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = await SupabaseManager.shared.accessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONEncoder().encode(body)

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.badResponse(-1, "no response") }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.badResponse(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// POST JSON to an iOS-facing public API route at `/api/public/ios/<path>`.
    func callAPI<Response: Decodable, Body: Encodable>(
        path: String,
        body: Body,
        as: Response.Type = Response.self
    ) async throws -> Response {
        try await request(method: "POST", path: path, body: body)
    }

    /// GET an iOS-facing public API route at `/api/public/ios/<path>`.
    func getAPI<Response: Decodable>(
        path: String,
        as: Response.Type = Response.self
    ) async throws -> Response {
        try await request(method: "GET", path: path, body: EmptyBody?.none)
    }

    /// DELETE with a JSON body to an iOS-facing public API route.
    func deleteAPI<Response: Decodable, Body: Encodable>(
        path: String,
        body: Body,
        as: Response.Type = Response.self
    ) async throws -> Response {
        try await request(method: "DELETE", path: path, body: body)
    }

    private struct EmptyBody: Encodable {}

    private func request<Response: Decodable, Body: Encodable>(
        method: String,
        path: String,
        body: Body?
    ) async throws -> Response {
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = Config.apiBaseURL
            .appendingPathComponent("api/public/ios")
            .appendingPathComponent(cleanPath)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = await SupabaseManager.shared.accessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.badResponse(-1, "no response") }
        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw APIError.badResponse(http.statusCode, msg)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// Streams SSE lines from POST /api/chat (matches src/routes/api/chat.ts).
    func streamChat(body: Data) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = Config.apiBaseURL.appendingPathComponent("api/chat")
                    var req = URLRequest(url: url)
                    req.httpMethod = "POST"
                    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    if let token = await SupabaseManager.shared.accessToken() {
                        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }
                    req.httpBody = body

                    let (bytes, resp) = try await URLSession.shared.bytes(for: req)
                    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
                        continuation.finish(throwing: APIError.badResponse(code, "chat stream failed"))
                        return
                    }
                    for try await line in bytes.lines {
                        continuation.yield(line)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
