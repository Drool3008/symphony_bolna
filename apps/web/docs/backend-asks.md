# Backend asks from the web client

What the web client needs and the backend does not have yet. Each ask names
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

Ask: filter `/events` by `X-Member-Id` (the client can send it; it reads the
stream with `fetch`), or offer a per-member stream next to the operator's
full one.

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

## 5. CORS for a build served from another origin

The server sends no CORS headers (`server/src/app.ts`). Development is fine
through the Vite proxy, but `VITE_API_BASE` (a build on another origin, or a
phone opening a hosted build) needs them. The handoff lists the reference's
permissive CORS as planned (HANDOFF section 11, Stage 6).

## 6. Type everything the server sends

- `shared/src/events.ts` names 7 event types and no payloads; the server
  emits 24 plus `sync`. The client types them in
  `apps/web/src/api/events.ts` until `shared/` does.
- `POST /api/input` answers `{ ok: true, as: 'reply' | 'input' }`,
  `POST /api/reply` answers `{ ok: true, delivered: boolean }`, and
  `POST /api/forward` answers `{ ok: true }` (`server/src/app.ts`). None has
  a type in `shared/src/api.ts`, nor does `POST /api/input`'s request body
  (`text`, `sample_id`). The client types them in `apps/web/src/api/client.ts`.
- The card object on `ThreadMessage` is `Record<string, unknown>`; its fields
  live only in a tool description (`server/src/agent/tools.ts`).

## 7. Who answered a card

`card_answered` carries `message_id`, `answer` and `at`, and the stored
message carries `answer` and `answered_at`, but not who answered. Today only
the card's own recipient may answer (`server/src/app.ts`), so the client can
infer it. The brief asks that a card "show who answered", and the design must
show "what has been decided and by whom". If anyone else may ever answer, the
server needs to record it.
