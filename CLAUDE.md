# Standing rules for this repository

These restate the build brief's rules on how to work, what was removed, and how
commits are written. They apply to every session, person or agent.

## How to work

1. **A rebuild, not a fork.** The reference simulator lives outside this
   repository, read-only, at `../super-duper-engine-reference`. Read it to
   understand the product, its rules and its logic, then write new code. Never
   copy its source files across and edit them; port the logic by rewriting it.
2. **Traceability.** Every behaviour traces to the reference repository (name
   the file), the build brief, or an answer from the project owner. Anything
   new that none of those cover is a proposal: say so in the commit body and in
   `docs/decisions.md`, and keep it small.
3. **Never invent data.** No new people, clinics, chemists, medicines, phone
   numbers, prices or API fields. The seeded family and providers come from
   `config/onboarding.json`. A missing value gets a clearly marked placeholder
   and an entry in the open questions.
4. **Backend only.** The client platform is undecided. Build so a web app, an
   Expo app or a wrapped web app can all talk to the backend. No product UI;
   the only page is a bare operator page for dry runs, and it is a dev tool.
5. **Commits are part of the deliverable.** See below.
6. Do not push. Do not add a remote unless given one. Do not force anything.
7. When something is unclear or conflicts with the reference, ask. Do not guess.

## What was removed

The reference wired three outside vendors: a payment rail, a courier, and a
speech (STT/TTS) vendor, plus a later proposal to move speech to a second
speech vendor. **All of them are gone, and none may come back.** Their names,
tools, fixtures, onboarding fields and environment variables are listed once,
in `docs/decisions.md`, and nowhere else in the repository. Do not write those
names in code, comments, tests, config, fixtures or other docs: the final check
greps the whole repository for them, excluding only `docs/decisions.md`.

What replaces each one:

- **Money** is a ledger the server keeps. A spend is a ledger entry with
  `rail: "recorded"`, written after the RP approved it, or after a critical-tier
  act-then-tell. Limits, the ask-first threshold, the low-wallet mark, top-ups
  and limit edits stay.
- **Dispensed quantity** comes from the chemist confirming it on their own
  screen, or from a receipt photo a member forwards. `set_refill_cycle` takes
  `chemist_confirmation` or `forwarded_receipt` and refuses `prescription` and
  `assumed`.
- **Delivery** is the chemist's: counter pickup or the chemist's own delivery.
  An episode closes when a person confirms the medicine reached the patient.
- **Voice** sits behind one speech port with two implementations: `none`
  (refuses clearly) and `operator` (a person types the transcript, and the
  record says so). `place_call` is played by a person.

The cab and ambulance adapter (Beckn) stays, answered from fixtures.

## Commits

### Voice

- Each subject is how a person on the team would describe the change to a
  teammate: plain English, sentence case, at most 72 characters, no trailing
  full stop.
- Say what changed and why it matters, not which files moved.
- A body is optional: a few lines of prose on why, the reference file it ports,
  and any proposal it makes.

### Banned

- No conventional-commit prefixes or scopes (`feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, `test:`, `style:`, `build:`, `ci:`, `perf:`,
  `(scope):`).
- None of these words anywhere in the subject: feat, feature, add, added, adds,
  adding, chore, refactor, wip, update, updated, bump, misc, msg,
  "initial commit".
- No emoji, no ticket numbers, no bracketed tags.

### No AI attribution

- No `Co-Authored-By` trailer, no `Claude-Session` trailer, no "Generated
  with" line, no session link, nothing naming an AI tool as an author or
  helper. Naming a model provider as a product feature is fine.
- `.claude/settings.json` switches Claude Code's commit and PR attribution off.
  That is not the guarantee; the hook is.
- `.githooks/commit-msg` rejects a message that breaks any of the above and
  prints which rule failed. Enable it once per clone:
  `git config core.hooksPath .githooks`.
- Use the git identity already configured. No `--author`, no `GIT_AUTHOR_*` or
  `GIT_COMMITTER_*`, no changed dates.
- After every commit, run `git log -1 --format=%B` and confirm there is no
  trailer. If one slipped through on an unpushed commit, amend that commit only.

### Discipline

- Commit as you go, in the plan's order. Never batch a stage into one commit.
- Each commit is one coherent, working change, and the tests that exist pass
  before it is made.
- Never commit secrets, `.env`, the SQLite file, `node_modules`, the build
  brief, or anything from the reference other than the listed data assets,
  each with its provenance in the commit body.
- Never rewrite history beyond amending the latest unpushed commit. Never push.
