import type { Strings } from '../i18n/format.js'

export type Decider = { kind: 'agent' } | { kind: 'person'; name: string }

/**
 * The small mark on every decision line saying who made it: the agent, or the
 * named person (owner's answer at Checkpoint A, taken from direction B). The
 * agent's mark is a diamond, a person's a disc, so it does not rely on colour.
 */
export function DecisionMark({ who, s }: { who: Decider; s: Strings }) {
  return (
    <span className={who.kind === 'agent' ? 'mark mark-agent' : 'mark mark-person'}>
      <span aria-hidden="true">{who.kind === 'agent' ? '◆ ' : '● '}</span>
      {who.kind === 'agent' ? s.t('agent') : who.name}
    </span>
  )
}
