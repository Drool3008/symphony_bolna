import { dictionaryFor, type StringKey } from './strings.js'

/** The family's clock is at +05:30 (config/onboarding.json, sim_clock). */
const FAMILY_ZONE = 'Asia/Kolkata'

export interface Strings {
  language: string
  locale: string
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** A calendar date (YYYY-MM-DD) as day and month, with the year when it is not `today`'s. */
  date: (iso: string, today?: string) => string
  /** A sim-time instant as the weekday and date on the family's clock. */
  longDate: (iso: string) => string
  /** A sim-time instant as the time on the family's clock. */
  time: (iso: string) => string
  num: (n: number) => string
}

export function stringsFor(language: string): Strings {
  const dict = dictionaryFor(language)
  const locale = language.toLowerCase().startsWith('te') ? 'te-IN' : 'en-IN'
  return {
    language,
    locale,
    t: (key, vars = {}) => dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? '')),
    date: (iso, today) =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        ...(today && iso.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
      }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)),
    longDate: (iso) =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: FAMILY_ZONE,
      }).format(new Date(iso)),
    time: (iso) =>
      new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: FAMILY_ZONE }).format(
        new Date(iso),
      ),
    num: (n) => new Intl.NumberFormat(locale).format(n),
  }
}
