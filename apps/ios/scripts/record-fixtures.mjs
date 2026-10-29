#!/usr/bin/env node
/* global process, fetch, console, setTimeout, AbortController, TextDecoder */
// Records the server's real answers into Tests/Fixtures/, for the decode tests
// and the SwiftUI previews (brief, Section 4). Rerun it whenever the backend
// changes: a fixture that no longer decodes means a Swift model is stale.
//
//   make fixtures                               a backend of its own, port 8799
//   node scripts/record-fixtures.mjs [base]     default http://localhost:8788
//
// It needs a backend on the scripted provider, and it resets that backend:
// `make fixtures` starts one for the purpose; never point it at a run you
// care about. It
// drives the default take (HANDOFF section 15) with the dev routes, playing
// the two chemists from the answers on file, then replays the whole run from
// a fresh stream connection and keeps those bytes exactly as sent.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] ?? 'http://localhost:8788'
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'Tests', 'Fixtures')
mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(method, path, { member, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(member ? { 'X-Member-Id': member } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: await res.json() }
}

function save(name, value) {
  writeFileSync(join(out, name), `${JSON.stringify(value, null, 2)}\n`)
  console.log('recorded', name)
}

/** Reads the stream for a while and returns its bytes as text. */
async function readStream(ms) {
  const ctl = new AbortController()
  const res = await fetch(`${base}/events`, { signal: ctl.signal })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const stop = Date.now() + ms
  try {
    while (Date.now() < stop) {
      const next = await Promise.race([reader.read(), sleep(stop - Date.now()).then(() => null)])
      if (!next || next.done) break
      text += decoder.decode(next.value, { stream: true })
    }
  } finally {
    ctl.abort()
  }
  return text
}

const events = (text) =>
  text
    .split('\n\n')
    .map((block) => block.split('\n').find((line) => line.startsWith('data: ')))
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(6)))

async function nextCall() {
  for (let i = 0; i < 200; i++) {
    const { json } = await call('GET', '/api/operator/queue')
    if (json.pending[0]) return json.pending[0]
    await sleep(50)
  }
  throw new Error('no call reached the operator queue')
}

const reset = await call('POST', '/api/reset', { body: { reason: 'recording fixtures' } })
if (reset.status !== 200) throw new Error(`reset failed: ${JSON.stringify(reset.json)}`)

save('members.json', (await call('GET', '/api/members')).json)
for (const [subject, asker] of [
  ['patient', 'patient'],
  ['rp', 'rp'],
  ['member_3', 'member_3'],
  ['patient', 'rp'],
  ['patient', 'member_3'],
])
  save(
    `home-${subject}-as-${asker}.json`,
    (await call('GET', `/api/members/${subject}/home`, { member: asker })).json,
  )
save('error-missing-member.json', (await call('GET', '/api/members/patient/home')).json)

// The default take, up to Arun's card.
await call('POST', '/api/clock', {
  body: { to_next_date: true, source: 'recording fixtures: the refill check' },
})
await call('POST', `/api/operator/queue/${(await nextCall()).id}`, {
  body: { variant: 'chemist_substitute_only' },
})
await call('POST', `/api/operator/queue/${(await nextCall()).id}`, {
  body: { variant: 'chemist_in_stock_kazipet' },
})
await sleep(500)
const card = events(await readStream(800)).find(
  (e) => e.type === 'message' && e.message.thread === 'rp' && e.message.card,
)
if (!card) throw new Error("Arun's card never arrived")
save(
  'reply-card.json',
  (
    await call('POST', '/api/reply', {
      member: 'rp',
      body: { message_id: card.message.id, action: 'Approve' },
    })
  ).json,
)
save(
  'error-card-answered.json',
  (
    await call('POST', '/api/reply', {
      member: 'rp',
      body: { message_id: card.message.id, action: 'Approve' },
    })
  ).json,
)
await sleep(500)

save(
  'chat-send.json',
  (
    await call('POST', '/api/chat/send', {
      member: 'member_3',
      body: { chat_id: 'rp', text: 'Recorded for the fixtures: a direct line' },
    })
  ).json,
)
save(
  'input.json',
  (
    await call('POST', '/api/input', {
      member: 'member_3',
      body: { text: 'Recorded for the fixtures: is Amma all right?' },
    })
  ).json,
)
save(
  'forward.json',
  (
    await call('POST', '/api/forward', {
      member: 'rp',
      body: { chat_id: 'patient', message_id: 'h2', note: 'recorded for the fixtures' },
    })
  ).json,
)
await sleep(800)

// The whole run as a fresh client receives it: replay, then sync.
writeFileSync(join(out, 'events.sse'), await readStream(1500))
console.log('recorded events.sse')
