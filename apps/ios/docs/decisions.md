# iOS client decisions

Every decision the iOS client makes, with where it comes from: `HANDOFF.md`
(section named), the backend code (file named), the reference simulator at
`../super-duper-engine-reference` (file named), the iOS brief, or an answer
from the project owner. Anything marked **Proposal** is new and open to being
overruled.

## Swift 6 language mode for strict concurrency

The brief asks for Swift 5.9 or later with strict concurrency checking on.
The installed Xcode (26.4) builds Swift 6; the project uses the Swift 6
language mode, where complete concurrency checking is the default, and sets
`SWIFT_STRICT_CONCURRENCY: complete` as well, so the intent is explicit.

## Bundle id `org.familyhealth.Vantari` (Proposal)

No bundle id is given anywhere. This one follows the packages' naming
(`@family-health/...`), which describes the code rather than the brand.

## Debug and Release use different Info.plist files

App Transport Security's exception has to be a boolean in Info.plist, and a
build setting cannot switch a dictionary on or off, so Debug builds use
`Config/Info-Debug.plist` (with `NSAllowsLocalNetworking` and
`NSLocalNetworkUsageDescription`) and Release uses `Config/Info.plist`
(neither). Both carry `API_BASE = $(API_BASE)`. Following the brief, only
`NSAllowsLocalNetworking` is set. **Not yet tested on a device against a raw
LAN IP**: no device is connected. The arbitrary-loads key waits on that
test failing. The usage description's wording is a proposal.

## The backend address: build setting first, launch argument for tests

`Config/Base.xcconfig` sets `API_BASE` to `http://localhost:8787`, the
backend's own port. `Config/Local.xcconfig` (git-ignored, written by
`scripts/lan-xcconfig.sh` from this Mac's IPv4 address, the idea of the
reference's `scripts/ios-build.mjs`) overrides it for a device. A launch
argument `-API_BASE <url>` overrides both through UserDefaults' argument
domain. UI tests use it to reach a backend of their own.

## Tests start their own backend on port 8799 (Proposal)

`make test` runs `scripts/with-backend.sh`, which starts the backend on the
scripted provider with a fresh temporary database on 8799 (away from 8787 and
from 8788, the port this session's dry runs use), passes it to the UI tests
as `TEST_RUNNER_API_BASE`, and stops it afterwards.

## Models are hand-written, field for field, and checked on recorded answers

Swift cannot import `shared/`, so each model file names the TypeScript type
it mirrors. Snake-case fields map through explicit `CodingKeys`, not the
decoder's snake-case strategy, which would also rewrite the keys inside a
card's free-form fields. A card's fields and tool arguments are `JSONValue`,
as `shared/` types them `unknown`. Bodies `shared/` does not type yet
(`POST /api/input`, `/api/reply`, `/api/forward`, the error body) are typed
in `Models/Responses.swift` from `server/src/app.ts` and `server/src/http.ts`.

## The first fixtures came before the script that records them

The brief's commit 4 checks models "on real answers", but the recording
script is commit 8. Commit 4's fixtures were recorded from a stub server on
port 8788 with the same steps the script later makes repeatable; commit 8
commits that script and reruns it. The test that decodes them also fails if a
fixture appears that no test reads.

## The stream is cut into lines from raw bytes

From the brief: iOS has no SSE client, and `AsyncLineSequence` is not relied
on. `LiveStream` reads `URLSession.bytes(for:)` and feeds each byte to
`SSEParser`, which cuts lines on LF, CR or CRLF (even a CRLF split across
chunks) and decodes UTF-8 only once a line is whole, so a Telugu character
split across chunks is never broken. The parser is tested on the recorded
take in chunks of 1, 2, 3, 7, 64 and 1000 bytes. Resume sends both
`Last-Event-ID` and `?since=` (`server/src/events.ts` reads either). The
backoff (0.5 s, 1 s, 2 s, 5 s, 10 s, then every 30 s) is a proposal.

## Every event type has a Swift payload, and unknown types are dropped

`shared/src/events.ts` names 7 types and no payloads. `StreamEvent` decodes
all 24 the server emits, plus `sync`, each payload naming the file that emits
it. A type it does not know decodes as `.unknown` and is dropped. A test
fails if the recorded take holds a type the app does not know.

## A reset clears every store; so does a sync from another generation

From the brief (Section 4) and `server/src/reset.ts`: a reset is a new run.
`AppModel` clears every registered store and has each read again what is on
screen. A `sync` reporting a generation other than the one the stores were
filled in is treated the same way, so a phone that was away during a reset
never shows the last run. The sim clock and stage come from `sync`, `clock`
and `stage`; the device's date is never used. Returning to the foreground
reconnects the stream at once.

## `make fixtures` records against a backend of its own

`scripts/record-fixtures.mjs` resets the backend it talks to, so `make
fixtures` runs it through `scripts/with-backend.sh` on port 8799 with a fresh
database, never against a run someone is watching. It drives the default take
with the dev routes, playing the two chemists with the answers on file
(`chemist_substitute_only`, `chemist_in_stock_kazipet`), taps Arun's card,
and keeps a fresh connection's replay as `events.sse`, byte for byte.

## Seeded history is missing, and work carries on (owner's instruction)

Verification 1 found that the seeded family history cannot reach a client
(`client-contract.md`). The brief says to stop and raise it; the owner's
instruction for this session says to record it in `backend-asks.md` and
carry on. The Family tab and forwarding wait on that ask.

## Direction A, with two things from B (owner's answer, Checkpoint A)

Plain page for both clients: ink on paper, rules instead of boxes, one
deep-orange accent only for "needs your answer". From direction B, only
these two: what waits on this member's answer is pinned at the top of the
agent thread until it is answered or times out, and every decision line
carries a mark saying who made it, the agent or the named person. Tokens,
type scale and names are shared with the web client (`docs/design-tokens.md`).
Superseded for the look by the owner's decision of 2026-10-30 (below).

## A String Catalog, looked up in the member's language

`Vantari/Strings/Localizable.xcstrings` holds the same keys and wording as the
web client's `src/i18n/strings.ts`: the reference client's own labels
(`src/lib/i18n.ts`) wherever it had them, and plain new English otherwise.
New Telugu is marked `needs_review` in the catalog itself, with a comment, so
it shows in Xcode as waiting for a native speaker. The language is the
member's onboarding `language`, not the device's: `Strings` reads the
`te.lproj` or `en.lproj` table directly. Dates and times are on the family's
clock (+05:30), with the year shown only when it differs.

## `-member-id` sets the starting member, once, at launch

UI tests and screenshots start the app as a given member, or as nobody, with
`-member-id <id>` (or `""`). UserDefaults' argument domain outranks anything
the app writes, so the choice is kept under its own key (`chosen-member`) and
the launch argument is copied into it once at launch
(`Identity.takeLaunchArgument`). Otherwise a pick made on the picker under
`-member-id ""` would never reach a request.

## The header and the tab bar are the reference's

The header is the reference's (`src/PhoneApp.tsx`, Header): the brand
gradient, the mark in a rounded square with a thin white ring, the product's
name from the one Swift constant, and the member's avatar and name in a
translucent pill. The pill opens nothing and has no chevron: Profile waits on
`GET /api/session`. Under the name, small, is the family's date on the sim
clock, which the header already showed; the reference's `Logo` in
`src/components/brand.tsx` has the same sub-line. The status line says
"Working on it…" from a `thinking` event until `idle` or `error`
(`server/src/agent/loop.ts`; a run cut short by a reset sends neither, and
the reset clears it), otherwise the stage the agent set (`stage.0` to
`stage.9`, `set_stage` in `server/src/agent/tools.ts`), otherwise "Here if
you need me", in the reference's words (`src/lib/i18n.ts`). The `sync` after
a replay says whether a run is going now (`running`), so a replay's old
`thinking` events do not leave it on. Its sparkle pulses while the agent
works, and stands still under Reduce Motion.

The tab bar is the reference's (`Nav`): a bar on `card` with a line on top,
each tab an icon in a 56 by 32 pill, filled `stage` when open, over its word.
The icons are SF Symbols (`house`, `bubble.left`, `person.2`, `wallet.pass`,
filled when open). Home, Chat (`tab_agent`, the reference's word) and Family
for everyone; the wallet is defined for the responsible person only and
hidden for everyone until the wallet routes exist. The header grows with
text size up to the first accessibility size and the tab bar up to the
largest standard size, so the screen keeps its room; the screens themselves
scale all the way.

## `-tab <id>` opens the app on a given tab (screenshots and UI tests)

`-tab agent` (or `home`, `family`) in UserDefaults' argument domain picks the
tab the app opens on. A tab the member does not have falls back to Home. The
tab is not remembered between launches.

## The reference look, adopted (owner's decision, 2026-10-30)

The owner overrode the brief's "the reference UI is not ported" (rule 5 and
Section 5) and direction A, "Plain page", for the look of both member apps:
they take the reference simulator's visual design, with its shield mark and
brand gradient. iOS stays native SwiftUI, restyled to match. What is built is
re-skinned; Wallet, Profile and Calls stay unbuilt until their routes exist,
with no stand-in figures. Everything else holds: the code is written here,
never copied; data comes only from the backend.

The tokens (`docs/design-tokens.md`) are read off the reference's
`tailwind.config.js` and `src/index.css`, with dark values of our own; the
shield mark, avatars and AI and Human tags are drawn in
`Vantari/Design/Brand.swift` from the reference's
`src/components/brand.tsx`. The mark keeps its own gradient start
(`#7C3AED`) and amber dot (`#FDE68A`), as brand.tsx gives them. Type keeps
Dynamic Type: each token maps to a text style, so every size scales, and the
reference's sizes are raised so body text is at least 16 (the brief). Touch
targets are 44 points, the reference's `h-11`. The picker keeps its
"Development identity" label and note, and gives each member's role in the
reference's words (`src/main.tsx`), in English, since no language is known
before a pick.

## Two contrast gaps the reference look brings

White on the brand gradient's teal end (`brand-3`, `#0EA5A4`) is 3.0:1,
below AA for small text. As in the reference, the header keeps its words on
the violet and indigo part (7.1:1 and 6.3:1) and on the translucent white
chips; nothing is written over the teal corner alone. The open card's band
writes `human` on `human-soft` at 4.2:1 in light mode; its words are bold and
the band is never the only sign that a card is open (the hand icon, the
Human tag and the amber border say it too). Both are recorded rather than
fixed, because fixing them changes the look the owner chose.

## The agent thread is rebuilt from the stream, in one store

There is no read route for a thread (backend ask 1), so `AgentThreadStore`
folds the stream as the web client's `src/data/agentThread.ts` does:
`message` adds or replaces a line, `card_answered` locks a card with its
answer at the envelope's sim clock (backend ask 8), `card_timed_out` marks
one nobody answered, `awaiting_reply` and `reply_settled` open and close the
waits on a member, and `sync` gives the waits open now. The stream carries
every member's events (ask 2); the store keeps them by thread, so a member
picked after the replay still finds their own, and every screen asks for one
member's share and shows nothing else. When a read route lands, `refetch`
reads it and no screen changes.

A connection's replay opens with the reset that began the current run. Taken
as a new run, it cleared the thread the replay then refilled, and the `sync`
after it, reporting the server's generation, cleared it again, so a launch
showed an empty chat. Before the first `sync` there is no older run on screen,
so that reset is now passed over, as the web client does (`src/api/live.ts`).
A phone that was away during resets learns of the new run from `sync` alone,
after the replay; it clears what it holds and asks the stream for the whole
run again from its start.

## Chat in the reference's look, with its unread count and its pull to Chat

The thread is laid out as the reference's `AgentChat`
(`src/components/AgentChat.tsx`, `UI Components/07-arun-chat-receipts.png`):
the chat wall with its dot grid, the agent's bubbles on the left with the
sparkle avatar on the first of a run and a "Vantari · AI" label, the member's
own on the right in green with their avatar, the time under each, and three
bouncing dots while the agent works (still under Reduce Motion). A card sits
inside its bubble in the reference's `DecisionCard` states, its fields shown
only when the card carries them; amounts and the wallet line appear only
inside cards in the member's own thread, which the server sends only to the
responsible person, and never on home or in the header. Fields the backend
has never sent (`receipt_no`, `items`, `total_inr`, `options`) are drawn when
present, as the spec asks, and tested on nothing invented.

As in the reference's `PhoneApp.tsx`, the Chat tab counts the agent's
messages since the member last had Chat open (in memory, so a relaunch counts
the run's messages again, as the reference did) and, with none unseen, shows
an amber dot while something waits on them. A card that arrives for this
member opens Chat on its own (`lastCard`), but only one that arrives live:
cards in a replay are history, and would pull every launch onto Chat.

A record card (`order_receipt`) is never counted as waiting, though the
reference's count included it: it has no buttons, so it cannot be answered.
(Proposal.)
