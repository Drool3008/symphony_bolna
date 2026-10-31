# Decisions

Every decision the rebuild makes, with where it came from: the reference
repository (`../super-duper-engine-reference`, file named), the build brief, or
an answer from the project owner. Anything marked **Proposal** is new and is
open to being overruled.

This is the one file in the repository allowed to name the removed vendors.

## Settled in the reference (not re-derived)

From `docs/workflow.md` in the reference, settled 2026-10-04:

1. Severity is assessed by the agent at the Assessing stage, not tagged in data.
2. The contact chain is by role, then listing order: affected person, RP, then
   the remaining members in onboarding order.
3. The RP's veto is after the fact. The flow never blocks waiting on the RP.
4. Emergency with nobody reachable: book transport, notify the clinic, alert
   the family group, keep calling down the chain. All four or none.

## Removed integrations (brief, Section 3.2)

| Vendor                          | What the reference had                                                                                                                                                                                                                                                                                                       | Gone from this repository |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Pine Labs (payments)            | `pinelabs_reserve_block`, `pinelabs_reserve_debit`, `pinelabs_reserve_status`, `pinelabs_payment_link_create`, `pinelabs_payment_link_status`, `pinelabs_payment_link_resend`, the imagined `pinelabs_dispensing_receipt`, `fixtures/pinelabs/`, `wallet.rail`, `wallet.reserve_pay_sub_id`, `settle_care`'s `pinelabs` rail | all of it                 |
| Delhivery (courier)             | `delhivery_pincode`, `delhivery_create_shipment`, `delhivery_pickup_request`, `delhivery_track`, the imagined `delhivery_named_recipient`, `fixtures/delhivery/`, `delhivery_pickup_registered` on chemists                                                                                                                  | all of it                 |
| Gnani / Vachana (speech)        | `server/rails/gnani.js`, `gnani_stt`, `gnani_tts`, the imagined `gnani_call_session`, `fixtures/gnani/`, `GNANI_API_KEY`, endpoints at `api.vachana.ai`                                                                                                                                                                      | all of it                 |
| Sarvam (speech, proposed later) | Indus voice agents, Saaras, Bulbul, Sarvam-105B, in the project proposal only                                                                                                                                                                                                                                                | never wired               |

Replacements are in the brief's Section 3.3 and restated in `CLAUDE.md`.

## Rebuild decisions

### Vendor names live only in this file

The brief asks `CLAUDE.md` to restate Section 3.2, which names the removed
vendors, and also asks that a final case-insensitive grep for them across the
repository, excluding only this file, returns nothing. Both cannot hold, so
`CLAUDE.md` and every other file describe the removals by kind (payment rail,
courier, speech vendor) and point here. Raised at Checkpoint 1.

### Only `server/` and `shared/` are npm workspaces

The brief lists `config/`, `fixtures/`, `reports/` and `media/` among the
workspaces. They hold data, not packages, so they are plain folders; making
them workspaces would mean a `package.json` in each for nothing. Raised at
Checkpoint 1.

### The onboarding schema lives in `shared/`

The brief's layout puts the schema under `server/src/config/`. It is in
`shared/src/onboarding.ts` instead so any client can import the types, and the
server's loader (`server/src/config/onboarding.ts`) uses it. zod has no Node
dependency, so it is safe for a browser or Expo client.

### Onboarding is checked strictly, beyond its shape (Proposal)

The reference parsed `config/onboarding.json` and trusted it
(`server/state.js`). The rebuild refuses at boot, listing each problem with
its field path, when: a key is unknown (so a removed rail's field cannot
return unnoticed), a member reference does not resolve, there is not exactly
one responsible person, a member has no consent entry, an id or a provider
rank repeats, a recurring test's prescription is not on file, or more is
spent than the limit. `_`-prefixed keys are comments and are ignored.
`call_chain.order` must name real members but may disagree with role order:
the derived order wins, as in the reference's `server/contacts.js`.

Enums are limited to the values the data uses: consent levels `full` and
`status_only`, medicine priority `low`, `medium`, `critical`, and the four
policy values as literals, since code depends on each.

### Days of cover and due dates

Days of cover is `floor(stock / daily_dose)`, from the reference's
`set_refill_cycle` (`server/acting.js`); stock is `pills_left`, or
`doses_left` for the inhaler. Next due is `last_done + every_days`; a test
past due is reported overdue with a negative `days_until_due`, not clamped.
Dates are calendar dates at the sim clock's own offset (+05:30), so results
never depend on the host's timezone.

### Seeded media moves from `public/media/` to `media/`

The brief's layout has a top-level `media/`. The history's `/media/...` URLs
are unchanged, and the server serves `media/` at `/media`. Fonts stay at
`assets/fonts/`, kept for the media generator.

### The media generator is not yet ported (open)

The brief keeps "the seeded records and media generation", but no commit in
the plan names the reference's `scripts/generate-family-media.ts`. The
generated outputs (history, media) and the fonts it uses are carried; the
script itself waits for a place in the plan. Raised at Checkpoint 1.

### `MODEL_PROVIDER` defaults to `stub` (Proposal)

The reference defaulted to `gemini`. A fresh clone with no keys now boots on
the scripted provider instead of failing for want of a key.

### Who may see whose record (Proposal)

Consent is read from onboarding (reference `config/onboarding.json`,
`consent`; the reference stored it and nothing read it). A member sees their
own record in full. The responsible person sees another member's under that
member's `share_with_rp`; anybody else under `share_with_family_group`, the
same as the group thread. Status only means no medicines, no tests and no
agent word. A member with no consent entry shares status only and has no
calls recorded. Requests name the asking member in `X-Member-Id` (brief,
Section 5.1); it is checked against onboarding, and a request without a known
member is refused.

### "Vantari" is a working name (owner's answer, Checkpoint 1)

The rebuild keeps "Vantari" as its working name for now. It lives in one
constant, `PRODUCT_NAME` in `shared/src/product.ts`, and in the README, so a
later rename touches as little as possible. Package names
(`@family-health/...`) describe what the code is, not the brand, and do not
change with it.

### The clock never runs backwards, and can jump to the agent's next date (Proposal)

From the reference's `POST /api/clock` (`server/index.js`): the clock moves
only when a person moves it, with a source label, never on a timer. Two
additions: a move to an earlier time is refused, so a wait or a reversal
window that closed cannot reopen; and `to_next_date` moves it to the start of
the next date the agent watches (a medicine running out, a test falling due),
on the family's clock. Each move reports the agent's dates it reached.

### Days of cover count down from when the stock was counted

The stock in onboarding is counted on the sim clock's start date, so the
run-out date is fixed at that date plus the days of cover, and the days left
fall as the clock moves. The reference read `pills_left` against the clock
without moving it, so the figure never changed.

### Who is asking: X-Member-Id, behind one function (owner's answer, Checkpoint 1)

Every route that needs to know who is asking calls `actor()` in
`server/src/auth.ts`, and nothing else reads the header. It checks the member
against onboarding (missing or unknown: 400) and, where a route asks for one,
the role (wrong role: 403). The wallet routes and the reversal route will
require the responsible person; the chemist's confirmation will require the
chemist. **The header identifies a member; it does not prove who they are.**
Real auth replaces the inside of `actor()` without touching a route, and stays
an open question until the client is chosen.

The chemist is not a family member, so how a chemist identifies itself is
still to be settled; it first matters in Stage 5.

### A forward names its record; the server finds the file (Proposal)

The reference's `POST /api/forward` took a media object from the client and
read the file at the path it gave. Here the client names the chat and the
message, and the server looks the record up in the seeded history and reads
the file from `media/` itself, so a forward can only ever send a record that
is in the history. The input the model gets is built as the reference built
it: kind, a source line naming the forwarder, the chat, the type and the
original date, and the forwarder's caption and note marked as theirs.

### Inputs that arrive mid-step wait for that step's results

A model's tool calls must be followed straight away by their results, or
Anthropic and Gemini refuse the history. The reference pushed an input onto
the history whenever it arrived (`server/agent.js`, `feed()`), so an input
that came while a call was waiting on a person landed between the calls and
their results. Here it waits in an `inbox` table and goes into the history
after the step's results. After a restart, calls left without results get one
saying the server restarted, and the operator items they were waiting on are
marked abandoned.

### OPERATOR_AUTO answers FIXTURE calls only

The brief defines `OPERATOR_AUTO` as answering FIXTURE calls from fixtures.
The reference's `CURTAIN_AUTO` also answered the phone call (`place_call`)
with a canned outcome. Here a PERSON call always waits for a person, which
keeps the reference's rule that an invented reply is never treated as real.
A dry run with nobody at the operator page stops at the first call.

### The Anthropic provider uses the official SDK, with today's request rules

The reference called Anthropic over raw REST with `temperature: 0.2` and
defaulted to `claude-sonnet-5`. The rebuild uses `@anthropic-ai/sdk`, which
also serves OpenCode Go through its `baseURL` and two headers. Three changes
follow the current API, not the reference:

- No `temperature`: the Messages API now refuses sampling parameters.
- `MODEL_NAME` defaults to `claude-opus-5-5`, at effort `high`, with the
  server-side refusal fallback (`fallbacks: "default"`) on Anthropic's own
  API only. A refusal that survives the fallback stops the run with an error
  rather than being read as an answer.
- The assistant's content blocks, thinking included, are stored with the turn
  and sent back unchanged; an edited thinking block fails the API's check.
  Gemini's parts are kept the same way, which keeps its thought signatures.

Gemini stays on REST `generateContent` with the reference's retry on 429 and
5xx and its default model. OpenCode Go keeps the reference's endpoint notes;
`OPENCODE_BASE_URL` is accepted as the full `/messages` URL, as the reference
took it, or as a root.

### The stub scripts, carried and rewritten where the rails were removed

`config/trigger-samples.json` is carried unchanged. `config/stub-script.json`
and `config/stub-scenarios.json` are carried with these changes only:

- `connector` values: WhatsApp becomes "In-app message", Gnani "Speech
  port", Pine Labs "Wallet ledger"; sources that named the speech vendor or
  a WhatsApp reply say "the speech port" and "reply in the app".
- `gnani_tts` (a question asked aloud at Listening) becomes `ask_followup`
  with `text`, `language` and `to`. **Proposal:** the tool's name and shape
  are new; it lands with Listening in Stage 4.
- `wallet_ledger_append` loses its `rail` argument; the ledger records
  `rail: "recorded"` itself.
- `set_refill_cycle` no longer appears with `source: "dispensing_receipt"`.
  In the default take it moves after the chemist's confirmation, with
  `source: "chemist_confirmation"`. The rail-only turns in `refill_tap`
  (reserve block and debit; pincode, shipment, pickup, tracking and named
  recipient) are replaced by: order and pay, ask the chemist to deliver and
  confirm the quantity, stop; on the chemist's confirmation, set the cycle,
  stop; on Lakshmi's confirmation, tell the family and return to Idle.
- The `_limits` note's paragraph on courier delivery is rewritten to match.

The stub keeps its place in the store, so a restart does not replay the
script from the top. The arguments of tools that land in Stage 5 may need
adjusting then.

### The system prompt: what changed from the reference, and why

`config/system-prompt.md` keeps R1 to R24 and their IDs. Only the wording the
removals force changed (`git diff --no-index` against the reference's file
shows each):

- Opening: "WhatsApp is how you reach people" becomes "You reach people by
  message and by phone". The channel is an open question, so it is not named.
- The family group: "a WhatsApp group" becomes "the family's shared group
  chat. You are a member of it."
- R2 and R23 named no channel in the reference, so they are unchanged.
- R5: "exactly as Gnani returned them" becomes "exactly as the speech
  provider or the person who typed it returned them".
- R14: "Pincode not serviceable for delivery" becomes "The chemist cannot
  deliver". The fallback (pickup from the nearest chemist, an auto for a
  family member) is unchanged.
- R15: unchanged. "Hold the booking unpaid" stays.
- R21: the dispensed quantity is read "from the chemist's confirmation, or
  from a receipt a member forwards to you" instead of "off the itemised
  receipt". Never from the prescription, as before.
- R24: one sentence added, "`settle_care` records the debit on the family's
  wallet ledger." Nothing else changed.
- How you work: "If a rail returns an error" becomes "If a tool returns an
  error".
- The reference prompt named no tool that has been removed, so no tool name
  was taken out.

The backend adds nothing else to the conversation: the onboarding data under
the rules, and the clock on each input (reference `server/agent.js`).

### The agent can change the family record only into a valid one (Proposal)

The reference's `record_update` and `set_refill_cycle` wrote any field into
onboarding. Here every write to the working copy is checked against the
schema first, and a change that would leave it invalid goes back to the model
as an error with nothing written. The fields the reference's agent wrote are
in the schema as optional: `next_refill_date`, `refill_source`,
`last_filled_at`, `last_filled_on`, `last_filled_quantity` on a medicine, and
`booked_for`, `booked_at` on a test.

### `place_call` refuses a number that is not on file (Proposal)

Before a call is parked for a person to play, its number is checked against
every number in onboarding (members, clinics, chemists, labs, 108). An
invented number goes back to the model as an error. The reference relied on
the prompt alone for this.

### Text files keep LF endings on every OS (Proposal)

Git for Windows checks text out with CRLF by default, which stops the
commit-msg hook from running and makes Prettier's check fail on every file.
`.gitattributes` keeps every text file LF. The hook's own test runs it through
`bash`, as git does, since Windows cannot start a script from its first line;
on Windows, run the tests from Git Bash.
