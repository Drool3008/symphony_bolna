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
