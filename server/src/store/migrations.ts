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
]
