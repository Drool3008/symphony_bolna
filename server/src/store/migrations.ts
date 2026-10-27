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
]
