/**
 * A figure of money in a line of text, in the forms this product writes: a
 * rupee sign, or Rs or INR, next to a number (reference server/agent.js,
 * mentionsMoney). Deliberately narrow: it is here to catch "paid Rs 420", not
 * to police every sentence with a digit in it, so "the 2 o'clock slot" goes
 * through.
 */
const MONEY_PATTERNS = [/₹\s*\d/, /\b(?:rs|inr)\b\.?\s*\d/i, /\d\s*(?:rupees|rs\b|inr\b)/i]

export const mentionsMoney = (text: string | null | undefined): boolean =>
  MONEY_PATTERNS.some((re) => re.test(String(text ?? '')))

/** Card fields that carry a figure. The reference checked the first two; a total or itemised lines are figures too. */
const MONEY_FIELDS = ['amount_inr', 'wallet_left_inr', 'total_inr', 'items']

export function cardCarriesMoney(card: Record<string, unknown> | null | undefined): boolean {
  if (!card) return false
  return (
    MONEY_FIELDS.some((f) => card[f] !== undefined) ||
    Object.values(card).some((v) => typeof v === 'string' && mentionsMoney(v))
  )
}
