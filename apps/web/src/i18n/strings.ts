/**
 * English and Telugu strings. Each member sees the app in the language set
 * for them at onboarding (GET /api/members, `language`).
 *
 * Strings marked "reference" are the reference client's own wording
 * (../super-duper-engine-reference/src/lib/i18n.ts). Telugu strings marked
 * "proposal" are new and wait for a native speaker's review
 * (docs/decisions.md lists them).
 */
const en = {
  // reference
  tab_home: 'Home',
  tab_agent: 'Chat',
  tab_family: 'Family',
  tab_wallet: 'Wallet',
  medicines: 'Medicines',
  tests: 'Tests',
  latest: 'Latest from your agent',
  nothing_on_file: 'Nothing on file.',
  must_not_miss: 'Must not be missed',
  days_left_label: 'days left',
  runs_out: 'runs out {d}',
  last_done: 'last done {d}',
  next_due: 'due {d}',
  overdue: 'overdue since {d}',
  every_n_days: 'every {n} days',
  whose: "{name}'s medicines",
  stock_left: '{n} left',
  stock_counted: '{n} left when counted on {d}',
  message: 'Message…',
  send: 'Send',
  no_messages: 'No messages yet.',
  needs_answer: 'Needs your answer',
  working: 'Working on it…',
  // new
  agent: 'Your agent',
  you: 'You',
  if_no_answer: 'If you do not answer',
  answered_by: 'Answered by {name}',
  timed_out: 'Nobody answered in time',
  agent_goes_on: 'Your agent goes on by its rules',
  offline: 'The app cannot reach the family server right now.',
  family_waiting: 'Family chats open here once the server can send them.',
  card_amount: 'Amount',
  card_to: 'To',
  card_for: 'For',
  card_what: 'What',
  card_wallet_after: 'Wallet after',
  sending: 'Sending…',
  unit_pills: 'pills',
  unit_doses: 'doses',
} as const

export type StringKey = keyof typeof en

const te: Record<StringKey, string> = {
  // reference
  tab_home: 'హోమ్',
  tab_agent: 'చాట్',
  tab_family: 'కుటుంబం',
  tab_wallet: 'వాలెట్',
  medicines: 'మందులు',
  tests: 'పరీక్షలు',
  latest: 'మీ సహాయకుడి నుండి తాజా సమాచారం',
  nothing_on_file: 'ఏమీ నమోదు కాలేదు.',
  must_not_miss: 'తప్పకుండా వేసుకోవాలి',
  days_left_label: 'రోజులకు సరిపోతాయి',
  runs_out: '{d}న అయిపోతాయి',
  last_done: 'చివరిసారి {d}',
  next_due: 'తదుపరి {d}',
  overdue: '{d} నుండి గడువు దాటింది',
  every_n_days: 'ప్రతి {n} రోజులకు',
  whose: '{name} మందులు',
  stock_left: '{n} మిగిలాయి',
  stock_counted: '{d}న లెక్కించినప్పుడు {n} మిగిలాయి',
  message: 'సందేశం…',
  send: 'పంపండి',
  no_messages: 'ఇంకా సందేశాలు లేవు.',
  needs_answer: 'మీ సమాధానం కావాలి',
  working: 'పని జరుగుతోంది…',
  // proposal: new Telugu, to be reviewed
  agent: 'మీ సహాయకుడు',
  you: 'మీరు',
  if_no_answer: 'మీరు సమాధానం ఇవ్వకపోతే',
  answered_by: '{name} సమాధానం ఇచ్చారు',
  timed_out: 'సమయానికి ఎవరూ సమాధానం ఇవ్వలేదు',
  agent_goes_on: 'మీ సహాయకుడు తన నియమాల ప్రకారం కొనసాగుతాడు',
  offline: 'ఇప్పుడు యాప్ కుటుంబ సర్వర్‌ను చేరుకోలేకపోతోంది.',
  family_waiting: 'సర్వర్ పంపగలిగినప్పుడు కుటుంబ చాట్‌లు ఇక్కడ తెరుచుకుంటాయి.',
  card_amount: 'మొత్తం',
  card_to: 'ఎవరికి',
  card_for: 'ఎవరి కోసం',
  card_what: 'ఏమిటి',
  card_wallet_after: 'తర్వాత వాలెట్‌లో',
  sending: 'పంపుతోంది…',
  unit_pills: 'మాత్రలు',
  unit_doses: 'డోసులు',
}

export const dictionaries = { en, te } as const

/** The dictionary for a BCP-47 language code: Telugu for te-*, English otherwise. */
export function dictionaryFor(language: string): Record<StringKey, string> {
  return language.toLowerCase().startsWith('te') ? te : en
}
