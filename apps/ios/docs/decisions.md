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
