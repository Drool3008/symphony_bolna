import { cardCarriesMoney, mentionsMoney } from '../domain/money.js'
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

/**
 * R18, the half that can be checked in code: the family group hears what is
 * happening and who is handling it, never what it cost. A message to the group
 * with a figure in its text or its card is refused, and the model is told why,
 * so it can send the amount to the RP and post the group the same line without
 * the number (reference server/agent.js, send_message).
 */
export const noFiguresInGroup: Guard = (call) => {
  if (call.name !== 'send_message' || call.args.to !== 'family_group') return undefined
  let card: Record<string, unknown> | null = null
  if (typeof call.args.card === 'string') {
    try {
      card = JSON.parse(call.args.card) as Record<string, unknown>
    } catch {
      card = null
    }
  }
  if (!mentionsMoney(call.args.text as string) && !cardCarriesMoney(card)) return undefined
  return {
    ok: false,
    rule: 'R18',
    error:
      'R18: the family group gets status only, never a cost. Send the amount to the RP and post the group a status line with no figure in it.',
  }
}

export const defaultGuards = (): Guard[] => [knownRule(), r19, noFiguresInGroup]
