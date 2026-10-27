import type { AgentEvent } from '@family-health/shared'
import type { Db } from './db.js'
import type { SessionValues } from './session.js'

interface Row {
  seq: number
  type: string
  payload: string
  sim_time: string
  wall_time: string
}

/**
 * The append-only log. Each event carries its sequence number, the wall time
 * and the sim time it happened at. A reset does not delete anything: it moves
 * to a new generation, and only the current generation is replayed.
 */
export class EventLog {
  private readonly insert
  private readonly selectSince

  constructor(
    db: Db,
    private readonly session: SessionValues,
  ) {
    this.insert = db.prepare(
      'INSERT INTO events (generation, type, payload, sim_time, wall_time) VALUES (?, ?, ?, ?, ?)',
    )
    this.selectSince = db.prepare(
      'SELECT seq, type, payload, sim_time, wall_time FROM events WHERE generation = ? AND seq > ? ORDER BY seq',
    )
  }

  generation(): number {
    return this.session.get<number>('generation') ?? 1
  }

  /** Starts a new generation. Earlier events stay in the table and are no longer replayed. */
  nextGeneration(): number {
    const next = this.generation() + 1
    this.session.set('generation', next)
    return next
  }

  append(type: string, payload: Record<string, unknown>, simTime: Date): AgentEvent {
    const wall = new Date().toISOString()
    const clock = simTime.toISOString()
    const { lastInsertRowid } = this.insert.run(this.generation(), type, JSON.stringify(payload), clock, wall)
    return { ...payload, seq: Number(lastInsertRowid), type, at: wall, clock }
  }

  /** This generation's events after `seq`, in order. */
  since(seq = 0): AgentEvent[] {
    return (this.selectSince.all(this.generation(), seq) as Row[]).map((r) => ({
      ...(JSON.parse(r.payload) as Record<string, unknown>),
      seq: r.seq,
      type: r.type,
      at: r.wall_time,
      clock: r.sim_time,
    }))
  }
}
