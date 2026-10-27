/**
 * Schema changes, in order, each applied once. A migration is never edited
 * after it is committed; a change is a new migration at the end.
 */
export interface Migration {
  id: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'event log and session values',
    sql: `
      -- Everything that happens, in order. Append-only: rows are never updated
      -- or deleted, a reset starts a new generation instead. This is the audit
      -- trail, and what a late client replays.
      CREATE TABLE events (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        generation INTEGER NOT NULL,
        type       TEXT    NOT NULL,
        payload    TEXT    NOT NULL,
        sim_time   TEXT    NOT NULL,
        wall_time  TEXT    NOT NULL
      );
      CREATE INDEX events_by_generation ON events (generation, seq);
      CREATE TRIGGER events_no_update BEFORE UPDATE ON events
        BEGIN SELECT RAISE(ABORT, 'the event log is append-only'); END;
      CREATE TRIGGER events_no_delete BEFORE DELETE ON events
        BEGIN SELECT RAISE(ABORT, 'the event log is append-only'); END;

      -- Single values the session holds: the clock, the stage, the working
      -- copy of onboarding, the generation.
      CREATE TABLE session (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: 'conversations',
    sql: `
      -- The agent's conversation with each person, one thread per person,
      -- plus the family group and the doctor. Cards ride on messages.
      CREATE TABLE messages (
        seq          INTEGER PRIMARY KEY AUTOINCREMENT,
        id           TEXT    NOT NULL UNIQUE,
        thread       TEXT    NOT NULL,
        sender       TEXT    NOT NULL,
        recipient    TEXT    NOT NULL,
        text         TEXT    NOT NULL,
        language     TEXT,
        kind         TEXT,
        card         TEXT,
        answer       TEXT,
        answered_at  TEXT,
        timed_out_at TEXT,
        at           TEXT    NOT NULL
      );
      CREATE INDEX messages_by_thread ON messages (thread, seq);

      -- What the family says to each other. Never read by the model (R2).
      CREATE TABLE chat_messages (
        seq      INTEGER PRIMARY KEY AUTOINCREMENT,
        id       TEXT    NOT NULL UNIQUE,
        chat_key TEXT    NOT NULL,
        sender   TEXT    NOT NULL,
        text     TEXT    NOT NULL,
        to_agent INTEGER NOT NULL DEFAULT 0,
        at       TEXT    NOT NULL
      );
      CREATE INDEX chat_messages_by_key ON chat_messages (chat_key, seq);
    `,
  },
  {
    id: 3,
    name: 'model history',
    sql: `
      -- What the model has been given and has said, turn by turn. The only
      -- conversation the model reads (R2).
      CREATE TABLE history (
        seq  INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        turn TEXT NOT NULL
      );
    `,
  },
  {
    id: 4,
    name: 'inbox and operator queue',
    sql: `
      -- Inputs that arrived while a step was in flight, waiting to go into
      -- the history after that step's results.
      CREATE TABLE inbox (
        seq  INTEGER PRIMARY KEY AUTOINCREMENT,
        turn TEXT NOT NULL
      );

      -- Tool calls a person or a fixture answers (reference server/curtain.js).
      CREATE TABLE operator_queue (
        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
        id          TEXT    NOT NULL UNIQUE,
        call_id     TEXT    NOT NULL,
        tool        TEXT    NOT NULL,
        mode        TEXT    NOT NULL,
        request     TEXT    NOT NULL,
        fixtures    TEXT    NOT NULL,
        state       TEXT    NOT NULL,
        response    TEXT,
        variant     TEXT,
        via         TEXT,
        created_at  TEXT    NOT NULL,
        resolved_at TEXT
      );
    `,
  },
  {
    id: 5,
    name: 'decision log',
    sql: `
      -- One row per log_decision: what came in, from where, what was decided,
      -- under which rule, what was done and for whom, through what. The
      -- family's and the doctor's record, and the audit trail.
      CREATE TABLE decisions (
        seq       INTEGER PRIMARY KEY AUTOINCREMENT,
        sim_time  TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        received  TEXT NOT NULL,
        source    TEXT NOT NULL,
        decided   TEXT NOT NULL,
        rule_id   TEXT NOT NULL,
        why       TEXT NOT NULL,
        action    TEXT NOT NULL,
        recipient TEXT NOT NULL,
        connector TEXT NOT NULL
      );
    `,
  },
  {
    id: 6,
    name: 'waits',
    sql: `
      -- The agent waiting on a person. Ends on a reply, a "nobody answered",
      -- or the sim clock passing the deadline; never on a wall-clock timer.
      CREATE TABLE waits (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        id         TEXT NOT NULL UNIQUE,
        member     TEXT NOT NULL,
        what_for   TEXT NOT NULL,
        deadline   TEXT NOT NULL,
        state      TEXT NOT NULL,
        result     TEXT,
        opened_at  TEXT NOT NULL,
        settled_at TEXT
      );
    `,
  },
]
