# Vantari, the Family Health Agent

An agent that manages one Indian family's health. It watches medicines and
recurring tests, takes in a trigger, reaches the right person, listens,
assesses how urgent it is, acts (books, orders, arranges transport, spends from
a family wallet), keeps the family informed, hands the record to the doctor,
and closes the loop.

It records and routes. It never diagnoses, never gives a dose, never names a
condition, and never substitutes a medicine.

This repository is a rebuild, backend first. It ports the rules and the logic
of a working simulator into a new TypeScript codebase. The client platform (a
web app, an Expo app, or a wrapped web app) is not decided yet, so the backend
assumes no particular screen and no product UI lives here. The working name is
Vantari; whether it stays is an open question.

## Where things are

| Path | What it holds |
|---|---|
| `server/` | The backend: HTTP, the event stream, the agent loop, the domain rules |
| `shared/` | Types and request/response contracts any client can import |
| `config/` | Onboarding data for the seeded family, the system prompt, scripted flows |
| `fixtures/` | Answers for the transport adapter and for calls a person plays |
| `reports/`, `media/` | Seeded, fictional family records, each carrying a DEMO mark |
| `docs/` | Decisions, open questions, and how to run it |

## House rules

`CLAUDE.md` holds the standing rules for anyone (person or agent) working on
this repository: what may be ported, what was removed, and how commits are
written. `docs/decisions.md` records every decision and every proposal the
rebuild makes, with where it came from.
