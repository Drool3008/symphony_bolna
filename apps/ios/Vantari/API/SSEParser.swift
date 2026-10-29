import Foundation

/// One event as Server-Sent Events frames it.
struct SSEFrame: Equatable, Sendable {
    var id: String?
    var event: String?
    var data: String
}

/// A Server-Sent Events parser fed bytes as they arrive (the WHATWG event
/// stream format). iOS has no SSE client, and `AsyncLineSequence` is not
/// relied on to yield the blank lines that end events, so lines are cut here
/// from raw bytes. Lines end with LF, CRLF or CR; a blank line ends an event;
/// a line starting with a colon is a comment, such as the server's keepalive
/// (server/src/events.ts). A chunk may end anywhere, even inside a UTF-8
/// character: text is decoded only once a whole line is in.
struct SSEParser: Sendable {
    private var line: [UInt8] = []
    private var lastWasCR = false
    private var data: [String] = []
    private var id: String?
    private var event: String?

    mutating func feed<Bytes: Sequence>(_ bytes: Bytes) -> [SSEFrame] where Bytes.Element == UInt8 {
        var frames: [SSEFrame] = []
        for byte in bytes {
            if byte == 0x0A, lastWasCR {
                // The LF of a CRLF whose CR already ended the line.
                lastWasCR = false
                continue
            }
            lastWasCR = byte == 0x0D
            if byte == 0x0A || byte == 0x0D {
                if let frame = endLine() { frames.append(frame) }
            } else {
                line.append(byte)
            }
        }
        return frames
    }

    private mutating func endLine() -> SSEFrame? {
        let text = String(decoding: line, as: UTF8.self)
        line.removeAll(keepingCapacity: true)
        if text.isEmpty {
            defer {
                data = []
                id = nil
                event = nil
            }
            return data.isEmpty ? nil : SSEFrame(id: id, event: event, data: data.joined(separator: "\n"))
        }
        if text.hasPrefix(":") { return nil }
        let field: Substring
        var value: Substring
        if let colon = text.firstIndex(of: ":") {
            field = text[..<colon]
            value = text[text.index(after: colon)...]
            if value.hasPrefix(" ") { value = value.dropFirst() }
        } else {
            field = text[...]
            value = ""
        }
        switch field {
        case "data": data.append(String(value))
        case "id": id = String(value)
        case "event": event = String(value)
        default: break
        }
        return nil
    }
}
