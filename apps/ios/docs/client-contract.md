# Client contract: what the backend offers the iOS client today

Read off the backend at commit `78d9dee` (Stage 3 of 8), by running it on the
stub provider with a fresh database, calling every built route, and reading
`server/src/app.ts`, `server/src/http.ts`, `server/src/events.ts`,
`server/src/auth.ts`, `server/src/forward.ts`, `server/src/clock.ts`,
`server/src/store/conversations.ts`, `server/src/domain/waits.ts`,
`server/src/agent/loop.ts`, `server/src/agent/operator.ts`,
`server/src/agent/inbox.ts`, `server/src/agent/tools.ts` and
`shared/src/api.ts`. Every shape below was seen on the wire, from a stub
server on port 8788. The answers are kept in `apps/ios/Tests/Fixtures/`
(recorded by `scripts/record-fixtures.mjs`, `make fixtures`), and the unit
tests decode every one of them, so a model that drifts from the server fails
a test. Each answer here was checked again against the server code for this
client, not copied from the web client's notes.

## Conventions

- **Identity.** Routes that need to know the caller read `X-Member-Id`
  through `actor()` (`server/src/auth.ts`): `patient`, `rp` or `member_3`.
  Missing: 400 `X-Member-Id is required: say which family member is asking`.
  Unknown: 400 `X-Member-Id <id> is not a member of this family`. The
  header identifies; it proves nothing.
- **Errors.** Every refusal is JSON `{ "error": "<plain words>" }` with its
  status (`server/src/http.ts`). A bad body is a 400 naming each field, e.g.
  `text: say something`. Anything unexpected is a 500 with the same shape.
- **Times.** `clock`, `at` on messages, `when` on decisions and every date
  the server computes are **simulated** time. `at` on an event envelope and
  `logged_at` on a decision are wall time. The family's offset is +05:30;
  `today` and the `*_on`/`next_due` dates are calendar dates on it.
- **CORS.** None (`server/src/app.ts`). A native app does not need it;
  URLSession is not bound by the same-origin rule.
- **Cleartext.** The server speaks plain HTTP. The simulator reaches it as
  `localhost`; a phone needs this Mac's LAN address and the Debug-only
  `NSAllowsLocalNetworking` exception (`docs/decisions.md`).

## Member routes (built; screens may use these)

| Route                       | Request                                                                                                                                                                  | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Read from                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `GET /api/members`          | no header needed                                                                                                                                                         | `MembersResponse`: `{ members: [{ id, name, role, language }] }`. No phone numbers. Order is onboarding order: Lakshmi (`patient`, `te-IN`), Arun (`rp`, `responsible_person`, `en-IN`), Kavya (`member_3`, `family`, `en-IN`)                                                                                                                                                                                                                                                                                             | `app.ts`, `shared/src/api.ts`      |
| `GET /api/members/:id/home` | `X-Member-Id`                                                                                                                                                            | `MemberHomeResponse`: `{ member, clock, today, shared, medicines[], tests[], latest_agent_word }`. Medicine: `{ id, name, strength, purpose, schedule, must_not_miss, stock, unit ('pills' or 'doses'), stock_as_of, days_of_cover, runs_out_on }`. Test: `{ id, name, every_days, last_done, next_due, days_until_due, overdue }`; overdue has a negative `days_until_due`. `shared` is `full` or `status_only`; status only empties both lists. **`latest_agent_word` is always `null` today.** 404 for an unknown `:id` | `app.ts`, `domain/home.ts`         |
| `POST /api/input`           | `X-Member-Id`; `{ text, sample_id? }`                                                                                                                                    | `{ ok: true, as: 'reply' \| 'input' }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `app.ts`                           |
| `POST /api/reply`           | `X-Member-Id`; `ReplyRequest` `{ text?, action?, message_id? }`, one of `text` or `action` required                                                                      | `{ ok: true, delivered: boolean }`. With `message_id`: 404 `no card for you with that id` if the card is not in the caller's thread or is not a card; 409 `that card is already answered`                                                                                                                                                                                                                                                                                                                                  | `app.ts`, `store/conversations.ts` |
| `POST /api/chat/send`       | `X-Member-Id`; `ChatSendRequest` `{ chat_id, text, ask_agent? }`. `chat_id` is a member id (direct chat) or `family_group`                                               | `ChatSendResponse` `{ key, message: ChatMessage }`. `key` is `family_group` or `dm:<a>:<b>`, ids sorted. 400 for an unknown chat, a chat with yourself, or `ask_agent` outside the group                                                                                                                                                                                                                                                                                                                                   | `app.ts`, `store/conversations.ts` |
| `POST /api/forward`         | `X-Member-Id`; `ForwardRequest` `{ chat_id, message_id, caption?, note? }`, naming a message **in the seeded history** (`config/family-history.json`) that carries media | `{ ok: true }`. 404 `no message <id> in chat <chat>`; 400 if the message has no record                                                                                                                                                                                                                                                                                                                                                                                                                                     | `app.ts`, `forward.ts`             |
| `GET /media/<file>`         | none                                                                                                                                                                     | the file, e.g. `/media/rx-patient.png` (`image/png`), `/media/report-patient-bloods.pdf`                                                                                                                                                                                                                                                                                                                                                                                                                                   | `app.ts` (`express.static`)        |

### How `POST /api/input` routes a line (`app.ts`)

1. The line is stored in the caller's agent thread as a `message` from the
   caller to `agent` (so their screen shows it).
2. If the agent has an open wait on the caller, the line ends it as their
   reply: `as: 'reply'`.
3. Otherwise it goes to the model as a new input with the source
   `<Name>, in the chat with the agent`: `as: 'input'`.

`sample_id` only picks the stub's script and emits `scenario_selected`; the
model never sees it.

### How `POST /api/reply` works (`app.ts`)

With `message_id`, the card must be in the caller's own thread and
unanswered. The answer (`action`, else `text`) is locked on it and
`card_answered` goes out. Then a `reply` line is stored in the caller's
thread, and any wait on the caller ends (`delivered: true`, plus
`reply_settled`). Without a wait, `delivered` is `false`.

### How `@agent` works (`app.ts`)

`ask_agent: true` in `family_group` stores the line with `to_agent: true`. It
ends a wait on the sender or on the group if there is one; otherwise it goes
to the model as `<Name>, in the family group, addressed to the agent`. Every
other chat line is stored and broadcast and never reaches the model (R2).

## Dev routes (tests and dry runs only, never the member UI)

| Route                          | Request                          | Response                                                                                                        |
| ------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /api/clock`              | `{ to?, to_next_date?, source }` | `{ clock, reached: AgentDate[] }`. 400 going backwards or without a source                                      |
| `POST /api/reset`              | `{ reason? }`                    | the reset summary; 422 if onboarding on disk is bad                                                             |
| `POST /api/no-answer`          | `{ from }`                       | `{ ok: true, delivered }`                                                                                       |
| `GET /api/operator/queue`      | none                             | `{ pending: QueueItem[] }`                                                                                      |
| `POST /api/operator/queue/:id` | `{ variant?, response? }`        | `{ item: QueueItem }`. PERSON calls take an answer on file or a typed one; FIXTURE calls only an answer on file |

None of these reads `X-Member-Id`.

## The stream: `GET /events` (`server/src/events.ts`)

- Server-Sent Events. **No header is read and nothing is filtered by
  member**: every client receives every event.
- On connect the server writes a blank line, then **replays every event of
  the current generation** with `seq` greater than `Last-Event-ID` (or
  `?since=`, or 0), then one `sync` event, then live events. A keepalive
  comment (`: keepalive`) every 25 s.
- Logged events are framed `id: <seq>\ndata: <json>\n\n`. `sync` has no
  `id:` line and is not logged. No `event:` field is used; the type is in
  the JSON.
- Every logged event is one object: `seq`, `type`, `at` (wall time),
  `clock` (sim time), and its payload's fields at the top level (not under
  `payload`). **A payload field named `seq`, `type`, `at` or `clock` is
  overwritten by the envelope's** (`server/src/store/event-log.ts`,
  `append` spreads the payload first). This bites `card_answered`: the
  server passes the answer's sim time as `at`, and the wall time replaces it.
  Read the sim time of any event from its `clock`.

### Event types and payloads

Seen on the wire during the default take unless marked _(read from code)_.
Decoded on the client by `StreamEvent` in `apps/ios/Vantari/API/StreamEvent.swift`.

| Type                | Payload fields                                                                                                                                                                                               | Emitted by                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `sync`              | `clock, stage, generation, waits: OpenWait[], operator_pending, running, model`                                                                                                                              | `events.ts`, `runtime.ts`, providers in `waits.ts`, `operator.ts`, `loop.ts` |
| `reset`             | `reason, clock`                                                                                                                                                                                              | `reset.ts`                                                                   |
| `clock`             | `clock` (new sim time), `source`, `reached: AgentDate[]`                                                                                                                                                     | `clock.ts`                                                                   |
| `input`             | `input: { kind: 'message' \| 'clock' \| 'forwarded_record', source, at, from?, via?, text?, reached?, document?, caption_from_forwarder?, note_from_forwarder?, original_date? }`, `attachment?`             | `agent/inbox.ts`                                                             |
| `message`           | `message: ThreadMessage` `{ id, thread, from, to, text, language, kind, card, answer, answered_at, timed_out_at, at }`. `thread` is the member id, `family_group` or the doctor. `card` is an object or null | `store/conversations.ts`                                                     |
| `chat_message`      | `key, message: ChatMessage` `{ id, key, from, text, to_agent, at }`                                                                                                                                          | `store/conversations.ts`                                                     |
| `card_answered`     | `message_id, answer, at`                                                                                                                                                                                     | `store/conversations.ts`                                                     |
| `card_timed_out`    | `message_id, reason` _(read from code)_                                                                                                                                                                      | `domain/waits.ts`                                                            |
| `awaiting_reply`    | `id, from, what_for, wait_seconds, deadline`                                                                                                                                                                 | `domain/waits.ts`                                                            |
| `reply_settled`     | `id, from, result: { answered: true, from, text, action, at } \| { answered: false, from, reason, at }`                                                                                                      | `domain/waits.ts`                                                            |
| `no_answer`         | `from, source`                                                                                                                                                                                               | `app.ts`                                                                     |
| `decision`          | `decision: Decision` `{ seq, when, logged_at, received, source, decided, rule_id, why, action, recipient, connector }`                                                                                       | `store/decisions.ts`                                                         |
| `thinking`          | `step`                                                                                                                                                                                                       | `agent/loop.ts`                                                              |
| `model_step`        | `step, text, tool_calls: [{ id, name, args }]`                                                                                                                                                               | `agent/loop.ts`                                                              |
| `tool_call`         | `id, name, args, mode`                                                                                                                                                                                       | `agent/loop.ts`                                                              |
| `tool_result`       | `id, name, result`                                                                                                                                                                                           | `agent/loop.ts`                                                              |
| `tool_rejected`     | `id, name, reason, result` _(read from code)_                                                                                                                                                                | `agent/loop.ts`                                                              |
| `idle`              | `reason` _(read from code)_                                                                                                                                                                                  | `agent/loop.ts`                                                              |
| `error`             | `error` _(read from code)_                                                                                                                                                                                   | `agent/loop.ts`                                                              |
| `operator_pending`  | `item: QueueItem`                                                                                                                                                                                            | `agent/operator.ts`                                                          |
| `operator_resolved` | `id, response, variant, via`                                                                                                                                                                                 | `agent/operator.ts`                                                          |
| `record_update`     | `target, id, changes, why` _(read from code)_                                                                                                                                                                | `agent/tools.ts`                                                             |
| `scenario_selected` | `sample_id, script, note` _(read from code)_                                                                                                                                                                 | `app.ts`                                                                     |

### Cards

A card is the `card` object on a `ThreadMessage`. Its fields come from the
model (`server/src/agent/tools.ts`, `send_message`): `kind` (one of
`spend_above_threshold`, `new_doctor`, `new_medicine`, `disagreement`,
`cant_tell`, `low_wallet`, `dead_end`, `substitute_offered`,
`incident_summary`, `payment`, `booking`, `test_due`, `slot_unavailable`), and
optionally `title`, `detail`, `amount_inr`, `payee`, `wallet_left_inr`,
`medicine`, `strength`, `quantity`, `test`, `doctor`, `clinic`, `when`, `for`,
`why`, `options`, `buttons`, `on_timeout`. **`buttons` is optional and the
default take's card has none.** The server takes any `action` string as the
answer. The card Arun gets in the default take:

```json
{
  "kind": "spend_above_threshold",
  "amount_inr": 320,
  "payee": "Kazipet Pharmacy",
  "medicine": "Metoprolol",
  "strength": "25mg",
  "quantity": "60 tablets",
  "for": "Lakshmi",
  "wallet_left_inr": 4680,
  "why": "Above the ₹200 you set for asking first.",
  "on_timeout": "hold the order unpaid and call you"
}
```

## The four verifications (brief, Section 3)

### 1. Reading conversations

- **There is no GET route** for the agent thread, the family chats, or the
  seeded history. `server/src/app.ts` has no such route, and neither does
  anything it imports.
- **The agent thread and live family chats reach a client only as stream
  replay.** A fresh connection gets every `message` and `chat_message` of
  the current generation, so a client can rebuild them from the stream.
  Stored rows (`messages`, `chat_messages` tables) are never served
  directly.
- **The replay carries every member's threads to every client.** A client
  must keep only its own member's agent thread (`thread === me`), the group,
  and direct chats whose key contains its id. This is a privacy gap, not a
  filter: the server sends it all (see verification 2).
- **The seeded family history (`config/family-history.json`) cannot reach a
  client at all.** It is read only by `server/src/forward.ts`. Its media
  files are served under `/media`, but the chats that point at them are not.
  The same goes for `config/rp-history.json` (Arun's past escalations).
  `POST /api/forward` needs a history `chat_id` and `message_id` (such as
  `patient` / `h2`) that a client has no way to learn without reading the
  config file, which the brief forbids.
- **Seeded chat ids and live chat keys differ.** History chats are `patient`,
  `member_3`, `rp`, `family_group`; live direct chats are `dm:<a>:<b>`. One
  conversation cannot be put together from both without the backend saying
  how they map.

Outcome: the agent thread can be built now from the stream. The Family tab
can show live lines only, and forwarding (the context menu and note sheet in
Stage I5) cannot be offered. Raised in
`backend-asks.md`. The brief says to stop here; the owner's instruction for
this session says to record it and carry on, which is what was done.

### 2. Who is asking on the stream

`/events` reads no header and filters nothing (`server/src/events.ts`:
`streamEvents` reads only `Last-Event-ID` and `?since=`). The app's
`LiveStream` sends `X-Member-Id` on the stream request anyway, and the server
ignores it. Every connected phone receives every event: other members' agent
threads, Arun's spend card with its rupee figures, decisions, tool calls and
operator items with chemists' numbers. Raised as a backend ask: filter the
stream by `X-Member-Id`, which this app already sends, or offer a per-member
stream.

### 3. Typing to the agent

The client does not decide. A typed line goes to `POST /api/input`, and the
server decides (`app.ts`): if a wait is open on the caller
(`rt.waits.reply(memberId, ...)`), the line is their reply (`as: 'reply'`);
otherwise it is a new input (`as: 'input'`). A tap on a card goes to
`POST /api/reply` with `message_id` and `action`. `POST /api/reply` with text
alone also ends a wait, but `/api/input` already routes typed text, so the
composer uses `/api/input` only.

### 4. Event types

`shared/src/events.ts` names 7 (`reset`, `error`, `clock`, `stage`, `input`,
`message`, `chat_message`) and types no payloads. The server emits 24 types
plus `sync`. All have Swift payload types in
`apps/ios/Vantari/API/StreamEvent.swift`, each naming the file that emits it,
and the file says to replace them when `shared/` types the full set. An
unknown type decodes as `.unknown` and `LiveStream` drops it. A unit test
decodes every event in the recorded take and fails on a type the app does
not know.
