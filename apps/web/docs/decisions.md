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
