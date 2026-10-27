import type { Guard } from './loop.js'
import { ruleIds } from './prompt.js'

const succeeded = (result: unknown) =>
  typeof result === 'object' && result !== null && (result as { ok?: unknown }).ok === true

/**
 * R19, enforced rather than hoped for (reference server/agent.js): within one
 * step, nothing runs before a log_decision that was recorded. The refusal
 * says what to do and nothing about what to decide.
 */
export const r19: Guard = (call, { ran }) => {
  if (call.name === 'log_decision') return undefined
  if (ran.some((r) => r.call.name === 'log_decision' && succeeded(r.result))) return undefined
  return {
    ok: false,
    rule: 'R19',
    error: 'R19: call log_decision for this choice first, in this same step, then make this call again.',
  }
}

/**
 * A decision cites a rule the prompt has, or it is refused. The ids are read
 * off the prompt each time, so a rule added there is citable at once.
 */
export const knownRule =
  (ids: () => string[] = () => ruleIds()): Guard =>
  (call) => {
    if (call.name !== 'log_decision') return undefined
    const cited = call.args.rule_id
    const known = ids()
    if (typeof cited === 'string' && known.includes(cited)) return undefined
    return {
      ok: false,
      rule: 'rule_id',
      error: `rule_id must be one of ${known.join(', ')}. Cite the rule you actually followed.`,
    }
  }

export const defaultGuards = (): Guard[] => [knownRule(), r19]
