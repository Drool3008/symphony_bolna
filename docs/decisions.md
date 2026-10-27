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
