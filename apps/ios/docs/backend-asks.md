# Backend asks from the iOS client

What the iOS client needs and the backend does not have yet. The same gaps
the web client found (`apps/web/docs/backend-asks.md` on the web branch),
each checked again against the server for this client. Each ask names
the backend file it concerns. The client does not patch the backend; it
builds what it can and waits on these. Ordered by how much they block.

## 1. A way to read conversations, seeded history included (blocks Family and forwarding)

There is no GET route for the agent thread, the family chats or the seeded
history (`server/src/app.ts`). Live threads and chats can be rebuilt from
stream replay, but `config/family-history.json` and `config/rp-history.json`
never reach a client: only `server/src/forward.ts` reads them. Without them:

- the Family tab cannot show the seeded chats, photos or reports;
- forwarding cannot be offered, because `POST /api/forward` needs a history
  `chat_id` and `message_id` the client cannot learn;
- Arun's agent thread cannot open with his past escalations.

Ask: routes that return, for the asking member, their chats (group first,
then a direct chat with each member) with seeded and live lines together,
each line's media, and the ids `POST /api/forward` accepts; and their agent
thread, seeded history included. Also say how the seeded chat ids
(`patient`, `member_3`, `rp`, `family_group`) relate to the live keys
(`family_group`, `dm:<a>:<b>`).

## 2. The stream sends everything to everyone (privacy)

`GET /events` reads no header and filters nothing (`server/src/events.ts`).
Every client receives every member's agent thread, Arun's spend card with its
amounts, decisions, tool calls and operator items. That conflicts with R18
and the brief's rule that money figures go to the RP only. The client shows
only its own member's share, but the bytes still reach every phone.

Ask: filter `/events` by `X-Member-Id`, which the app already sends on the
stream request, or offer a per-member stream next to the operator's full one.

## 3. Fill `latest_agent_word` on home

`GET /api/members/:id/home` always returns `latest_agent_word: null`
(`server/src/domain/home.ts`), although the agent now writes to people. The
brief's home screen shows it. The client could work it out from the stream,
but the server already owns consent for this field (status only clears it),
so it belongs there.

## 4. Say which buttons a card has

A card's `buttons` are optional (`server/src/agent/tools.ts`), and the
default take's spend card to Arun has none, while `POST /api/reply` takes any
`action` string. A client would have to choose the labels itself, and that
choice becomes the answer the agent reads. The reference client had fallback
labels per kind (`src/components/AgentChat.tsx`, `DEFAULT_BUTTONS`: for
`spend_above_threshold`, "Approve" and "Hold unpaid").

Ask: always send `buttons`, or fill them per kind on the server, so the
choices a person sees and the answers the agent accepts come from one place.

## 5. HTTPS before any build leaves the Mac

The server speaks plain HTTP. Debug builds may reach it over the LAN through
`NSAllowsLocalNetworking`; Release builds keep App Transport Security fully
on (the brief), so a Release, TestFlight or App Store build cannot talk to
this backend until it is served over HTTPS. Not needed for the simulator or
a cable-connected phone in Debug.

## 6. Type everything the server sends

- `shared/src/events.ts` names 7 event types and no payloads; the server
  emits 24 plus `sync`. The app decodes them with hand-written Swift types
  in `apps/ios/Vantari/API/StreamEvent.swift`, which drift silently unless
  the recorded fixtures are rerun.
- `POST /api/input` answers `{ ok: true, as: 'reply' | 'input' }`,
  `POST /api/reply` answers `{ ok: true, delivered: boolean }`, and
  `POST /api/forward` answers `{ ok: true }` (`server/src/app.ts`). None has
  a type in `shared/src/api.ts`, nor does `POST /api/input`'s request body
  (`text`, `sample_id`). The app types them in
  `apps/ios/Vantari/Models/Responses.swift`.
- The card object on `ThreadMessage` is `Record<string, unknown>`; its fields
  live only in a tool description (`server/src/agent/tools.ts`).

## 7. Who answered a card

`card_answered` carries `message_id`, `answer` and `at`, and the stored
message carries `answer` and `answered_at`, but not who answered. Today only
the card's own recipient may answer (`server/src/app.ts`), so the client can
infer it. The brief asks that a card "show who answered", and the design must
show "what has been decided and by whom". If anyone else may ever answer, the
server needs to record it.

## 8. Payload fields are overwritten by the event envelope

`EventLog.append` (`server/src/store/event-log.ts`) returns
`{ ...payload, seq, type, at: wall, clock }`, so a payload field with one of
those names is silently replaced. `card_answered` passes the answer's sim
time as `at` (`server/src/store/conversations.ts`), and clients receive the
wall time instead. The client reads the sim time from `clock`, which happens
to match. Ask: keep payloads under their own key, or rename the colliding
fields (for example `answered_at`).

## 9. A typed contract a native client can generate from

Swift cannot import `shared/`, so every model is written by hand and kept
honest only by recorded fixtures. A machine-readable contract (an OpenAPI
document, or JSON Schema generated from the zod schemas the server already
has) would let the app generate its models and catch drift at build time.
