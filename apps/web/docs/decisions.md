# Web client decisions

Every decision the web client makes, with where it comes from: `HANDOFF.md`
(section named), the backend code (file named), the reference simulator at
`../super-duper-engine-reference` (file named), the web brief, or an answer
from the project owner. Anything marked **Proposal** is new and open to being
overruled.

## Vite follows the version vitest already installed

The root `vitest` brings Vite 7 into the tree. The web workspace uses the
same major version, so there is one copy of Vite and its plugin types agree.

## Results from browser tests go to the temp folder

Playwright writes traces and its last-run file to the system temp folder, not
to `apps/web`. The root `prettier --check .` and the vendor-name test scan
every untracked file that is not ignored, and the root ignore files are off
limits, so nothing a run leaves behind may land in the repository.

## `BACKEND_URL` points the dev proxy at the backend (Proposal)

The brief sets the default (`http://localhost:8787`) but names no variable.
`BACKEND_URL` overrides it for the dev server only. The browser tests use it
to reach a backend of their own on a spare port (8797) with a temporary
database, so they never touch a backend someone is already running.

## `VITE_API_BASE` for builds served elsewhere

From the brief and the reference (`src/lib/config.ts`): empty means the
page's own origin, which in development is the proxy.

## Response bodies shared/ does not type yet

`POST /api/input` (`{ ok, as }`), `POST /api/reply` (`{ ok, delivered }`) and
`POST /api/forward` (`{ ok }`) have no type in `shared/src/api.ts`. The client
types them in `src/api/client.ts` from `server/src/app.ts`, marked to be
replaced when `shared/` exports them. Listed in `backend-asks.md`.

## Errors keep the server's words

A refusal shows the server's own `error` text (`server/src/http.ts`), as the
brief asks. A request that never reaches the server says the app cannot reach
the family server and leaves the screen as it was.

## The stream is read with fetch, not EventSource

`/events` needs no header today (`server/src/events.ts`), so `EventSource`
would work. The client reads it with `fetch` and a stream reader instead
(`src/api/stream.ts`, `src/api/sse.ts`) so that it owns the backoff
(0.5 s, 1 s, 2 s, 5 s, 10 s, then every 30 s), resumes with both
`Last-Event-ID` and `?since=` (the server reads either), and can send
`X-Member-Id` the day the stream asks for it. The backoff delays are a
proposal.

## Event types are typed on the client for now

`shared/src/events.ts` names 7 event types and no payloads. The client types
all 24 that the server emits, plus `sync`, in `src/api/events.ts`, each with
the file that emits it, and marks the file to be replaced when `shared/`
types the full set. An event type the client does not know is dropped
without error.

## A reset clears the cache; so does a sync from another generation

From the brief (Section 4) and `server/src/reset.ts`: a reset is a new run.
`src/api/live.ts` resets every cached query except the session state, and
queries on screen fetch again. A `sync` that reports a generation other than
the cached one is treated the same way, so a client that was offline through
a reset never shows the last run. The sim clock and stage are kept from
`sync`, `clock` and `stage` events; the browser's own date is never used.
