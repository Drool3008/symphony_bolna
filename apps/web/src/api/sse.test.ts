import { describe, expect, it } from 'vitest'
import { SseParser } from './sse.js'

/** Bytes as server/src/events.ts writes them: a blank line, replayed events, then sync with no id. */
const RECORDED =
  '\n' +
  'id: 1\ndata: {"seq":1,"type":"reset","at":"a","clock":"c","reason":"probe"}\n\n' +
  'id: 2\ndata: {"seq":2,"type":"clock","at":"a","clock":"c","source":"probe","reached":[]}\n\n' +
  ': keepalive\n\n' +
  'data: {"type":"sync","at":"a","clock":"c","stage":1,"generation":1}\n\n'

describe('the stream parser', () => {
  it('reads recorded bytes into events, skipping the keepalive', () => {
    const frames = new SseParser().feed(RECORDED)
    expect(frames.map((f) => f.id)).toEqual(['1', '2', null])
    expect(frames.map((f) => JSON.parse(f.data).type)).toEqual(['reset', 'clock', 'sync'])
  })

  it('gives the same events however the bytes are split', () => {
    const whole = new SseParser().feed(RECORDED)
    for (let size = 1; size < 40; size += 3) {
      const parser = new SseParser()
      const frames = []
      for (let i = 0; i < RECORDED.length; i += size) frames.push(...parser.feed(RECORDED.slice(i, i + size)))
      expect(frames).toEqual(whole)
    }
  })

  it('takes CRLF and CR line endings, even a CRLF split across chunks', () => {
    const parser = new SseParser()
    const frames = [...parser.feed('id: 7\r\ndata: {"a":1}\r'), ...parser.feed('\n\r\n')]
    expect(frames).toEqual([{ id: '7', event: null, data: '{"a":1}' }])
  })

  it('joins multi-line data with newlines', () => {
    expect(new SseParser().feed('data: one\ndata: two\n\n')[0]?.data).toBe('one\ntwo')
  })
})
