/** One event as Server-Sent Events frames it. */
export interface SseFrame {
  id: string | null
  event: string | null
  data: string
}

/**
 * A Server-Sent Events parser fed text as it arrives (the WHATWG event stream
 * format). Lines end with LF, CRLF or CR; a blank line ends an event; lines
 * starting with a colon are comments, such as the server's keepalive
 * (server/src/events.ts). A chunk may end anywhere, even inside a line.
 */
export class SseParser {
  private buffer = ''
  private data: string[] = []
  private id: string | null = null
  private event: string | null = null
  private sawCr = false

  feed(chunk: string): SseFrame[] {
    const frames: SseFrame[] = []
    let text = chunk
    // A CR at the end of the last chunk and an LF at the start of this one are one line ending.
    if (this.sawCr && text.startsWith('\n')) text = text.slice(1)
    this.sawCr = false
    this.buffer += text

    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer)
      if (!match) break
      if (match[0] === '\r' && match.index === this.buffer.length - 1) {
        // Might be the first half of a CRLF split across chunks.
        this.sawCr = true
      }
      const line = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const frame = this.line(line)
      if (frame) frames.push(frame)
    }
    return frames
  }

  private line(line: string): SseFrame | null {
    if (line === '') {
      if (this.data.length === 0) {
        this.event = null
        return null
      }
      const frame = { id: this.id, event: this.event, data: this.data.join('\n') }
      this.data = []
      this.event = null
      this.id = null
      return frame
    }
    if (line.startsWith(':')) return null
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') this.data.push(value)
    else if (field === 'id') this.id = value
    else if (field === 'event') this.event = value
    return null
  }
}
