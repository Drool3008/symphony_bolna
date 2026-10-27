import type { Decision } from '@family-health/shared'
import { RUN_TABLES } from '../reset.js'
import type { Runtime } from '../runtime.js'

RUN_TABLES.push('decisions')

/**
 * The decision log: every choice the agent makes, recorded before it acts on
 * it (R19). The competition's Part 1 table in the reference, and the product's
 * audit trail here.
 */
export class DecisionLog {
  constructor(private readonly rt: Runtime) {}

  record(d: Omit<Decision, 'seq' | 'when' | 'logged_at'>): Decision {
    const when = this.rt.clock().toISOString()
    const logged_at = new Date().toISOString()
    const { lastInsertRowid } = this.rt.db
      .prepare(
        `INSERT INTO decisions (sim_time, logged_at, received, source, decided, rule_id, why, action, recipient, connector)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        when,
        logged_at,
        d.received,
        d.source,
        d.decided,
        d.rule_id,
        d.why,
        d.action,
        d.recipient,
        d.connector,
      )
    const row: Decision = { seq: Number(lastInsertRowid), when, logged_at, ...d }
    this.rt.emit('decision', { decision: row })
    return row
  }

  all(): Decision[] {
    return this.rt.db
      .prepare(
        `SELECT seq, sim_time AS "when", logged_at, received, source, decided, rule_id, why, action, recipient, connector
         FROM decisions ORDER BY seq`,
      )
      .all() as Decision[]
  }
}
