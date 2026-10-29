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
a reset never shows the last run. A connection's replay opens with the reset
that began the current run; before this app has seen its first `sync`, that
reset is ignored, because nothing from an older run can be cached yet and
clearing would blank what the page just fetched. The sim clock and stage are kept from
`sync`, `clock` and `stage` events; the browser's own date is never used.

## Contract checks run against a real server

`npm run test:contract -w @family-health/web` starts the backend on the
scripted provider, port 8798 and a temporary database
(`contract/server.ts`), and runs the client's own API code and stream
against it (`contract/backend.test.ts`): every member route, the stream's
replay and sync, the default take up to Arun's card and Lakshmi's Telugu
message, the second tap refused, forwarding, and reset. They also fail if
the server sends an event type the client does not know.

## Seeded history is missing, and work carries on (owner's instruction)

Verification 1 found that the seeded family history cannot reach a client
(`client-contract.md`). The web brief says to stop and raise it; the owner's
instruction for this session says to record it in `backend-asks.md` and
carry on with what can be built. The Family tab and forwarding wait on that
ask.

## Each phone keeps only its own member's share of the stream

The stream sends every member's events to every client (verification 2).
Until the backend filters it, screens show only what belongs to the chosen
member: their own agent thread (`thread` equal to their id), the family
group, and direct chats whose key contains their id. This hides; it does not
protect, which is why it is also a backend ask.

## Direction A, with two things from B (owner's answer, Checkpoint A)

Plain page for both clients: ink on paper, rules instead of boxes, one
deep-orange accent only for "needs your answer". From direction B, only
these two: what waits on this member's answer is pinned at the top of the
agent thread until it is answered or times out, and every decision line
carries a mark saying who made it, the agent or the named person. Tokens,
type scale and names are shared with iOS (`docs/design-tokens.md`).

## Strings: the reference's wording first, new Telugu as proposals

`src/i18n/strings.ts` takes every label it can from the reference client
(`src/lib/i18n.ts`), English and Telugu. The agent tab is the reference's
"Chat" (చాట్). Strings the reference does not have are new; their English
is plain, and **their Telugu is a proposal awaiting a native speaker**:
`agent` (మీ సహాయకుడు, built from the reference's own phrase), `you`,
`if_no_answer`, `answered_by`, `timed_out`, `agent_goes_on`, `offline`,
`family_waiting`, the five card field labels, and `sending`. The language is
the member's onboarding `language`, never the browser's. Dates and times are
on the family's clock (+05:30), and a date shows its year only when it is
not the year on that clock.

## Stock left says when it was counted

The server sends a medicine's stock as counted on `stock_as_of` and counts
the days of cover down from there (HANDOFF.md section 9). Once the clock has
moved past that day, home says "6 pills left when counted on 6 Oct" rather
than a bare "6 pills left", so the count is never read as today's. The
Telugu wording is a proposal.
