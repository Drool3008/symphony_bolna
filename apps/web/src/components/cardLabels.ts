/**
 * TEMPORARY FALLBACK. Remove when the server sends every card's title and
 * buttons (owner's answer at Checkpoint A: the backend session is making
 * cards always carry their buttons).
 *
 * Copied in substance from the reference client,
 * ../super-duper-engine-reference/src/components/AgentChat.tsx (TITLES and
 * DEFAULT_BUTTONS), so a card that names no buttons can still be answered.
 * The label pressed is the answer the agent reads.
 */
const FALLBACK_TITLES: Record<string, string> = {
  spend_above_threshold: 'Spend needs your OK',
  new_doctor: 'A doctor you have not used before',
  new_medicine: 'A medicine not on the list',
  disagreement: 'You and the patient disagree',
  cant_tell: 'I cannot tell how serious this is',
  low_wallet: 'Wallet running low',
  dead_end: 'I hit a dead end',
  substitute_offered: 'A chemist offered a substitute',
  incident_summary: 'What happened',
  test_due: 'A check-up is due',
  slot_unavailable: 'That doctor has nothing free',
  care_quote: 'Approve the visit and the cab',
  order_receipt: 'Paid and recorded',
}

const FALLBACK_BUTTONS: Record<string, string[]> = {
  spend_above_threshold: ['Approve', 'Hold unpaid'],
  new_doctor: ['Approve', 'Choose another', 'Call me'],
  new_medicine: ['Approve', 'Choose another', 'Call me'],
  disagreement: ['Act', "Don't act"],
  cant_tell: ['Treat as urgent', "It's fine", 'Call me'],
  low_wallet: ['Top up', 'Later'],
  dead_end: ['OK', 'Try something else'],
  substitute_offered: ['Ask the doctor', 'Decline'],
  incident_summary: [],
  payment: ['Approve', 'Hold unpaid'],
  booking: ['Yes', 'No'],
  test_due: ['Yes, book it', 'Not now'],
  slot_unavailable: ['Another doctor', 'Another date', "Don't book"],
  care_quote: ['Go ahead', 'Not now'],
}

export function cardTitle(kind: string): string {
  return FALLBACK_TITLES[kind] ?? kind
}

/** The card's own buttons when it names them; otherwise the temporary fallback. */
export function cardButtons(card: Record<string, unknown> | null): string[] {
  if (!card) return []
  const own = card.buttons
  if (Array.isArray(own) && own.every((b) => typeof b === 'string')) return own as string[]
  return FALLBACK_BUTTONS[String(card.kind ?? '')] ?? []
}
