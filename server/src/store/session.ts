import type { Db } from './db.js'

/** Single JSON values the session holds, by key. */
export class SessionValues {
  private readonly getStmt
  private readonly setStmt

  constructor(db: Db) {
    this.getStmt = db.prepare('SELECT value FROM session WHERE key = ?').pluck()
    this.setStmt = db.prepare(
      'INSERT INTO session (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    )
  }

  get<T>(key: string): T | undefined {
    const raw = this.getStmt.get(key) as string | undefined
    return raw === undefined ? undefined : (JSON.parse(raw) as T)
  }

  set(key: string, value: unknown): void {
    this.setStmt.run(key, JSON.stringify(value))
  }
}
