import { readFileSync } from 'node:fs'
import { fromRoot } from '../config/paths.js'

/**
 * The seeded past: months of family chats with the records people shared in
 * them, and the RP's already-resolved escalations. Carried from the reference
 * (config/family-history.json, config/rp-history.json), all fictional.
 *
 * Read only, and never given to the agent. The agent sees a record only when a
 * member forwards it (R2).
 */
export interface SharedMedia {
  type: 'pdf' | 'image'
  src: string
  thumb?: string
  name: string
  pages?: number
  size_kb?: number
}

export interface HistoryMessage {
  id: string
  from: string
  at: string
  text?: string
  caption?: string
  media?: SharedMedia
}

export interface HistoryChat {
  id: string
  name: string
  kind: 'direct' | 'group'
  messages: HistoryMessage[]
}

export interface FamilyHistory {
  chats: HistoryChat[]
}

export interface RpHistory {
  messages: {
    id: string
    from: string
    to: string
    at: string
    text?: string
    card?: Record<string, unknown>
  }[]
}

const read = <T>(path: string): T => JSON.parse(readFileSync(fromRoot(path), 'utf8')) as T

export const loadFamilyHistory = () => read<FamilyHistory>('config/family-history.json')
export const loadRpHistory = () => read<RpHistory>('config/rp-history.json')

/** Seeded media is served from here, at the /media/... paths the history uses. */
export const MEDIA_DIR = fromRoot('media')
