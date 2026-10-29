# Backend asks from the web client

What the web client needs and the backend does not have yet. Each ask names
the backend file it concerns. The client does not patch the backend; it
builds what it can and waits on these.

## Type the response bodies the server already sends

`POST /api/input` answers `{ ok: true, as: 'reply' | 'input' }`,
`POST /api/reply` answers `{ ok: true, delivered: boolean }`, and
`POST /api/forward` answers `{ ok: true }` (`server/src/app.ts`). None of
them has a type in `shared/src/api.ts`, nor does `POST /api/input`'s request
body (`text`, `sample_id`). The client types them itself in
`apps/web/src/api/client.ts` until `shared/` exports them.
