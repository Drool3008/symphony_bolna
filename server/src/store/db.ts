import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations.js'

export type Db = Database.Database

/**
 * Opens the session store and brings its schema up to date. `:memory:` gives
 * a throwaway store, which is what the tests use.
 *
 * The reference kept the session in memory and wrote a crash snapshot it never
 * read back (server/state.js). This store is read back: a restart carries on
 * where the last run stopped.
 */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
  )
  const applied = new Set(db.prepare('SELECT id FROM migrations').pluck().all() as number[])
  const record = db.prepare('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)')
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue
    db.transaction(() => {
      db.exec(m.sql)
      record.run(m.id, m.name, new Date().toISOString())
    })()
  }
}
