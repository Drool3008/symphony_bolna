/**
 * Calendar dates on the family's clock. The sim clock is an instant with an
 * offset (`2026-10-06T09:12:00+05:30`); "today" is the date at that offset,
 * not on the machine running the server, so a due date never moves with the
 * host's timezone.
 */

/** A YYYY-MM-DD date. */
export type CalendarDate = string

const DAY_MS = 86_400_000

/** Minutes east of UTC, read off an ISO timestamp's own offset. */
export function offsetMinutes(iso: string): number {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(iso)
  if (!m) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -minutes : minutes
}

/** The calendar date of an instant, at the given offset. */
export function calendarDate(instant: Date, offset: number): CalendarDate {
  return new Date(instant.getTime() + offset * 60_000).toISOString().slice(0, 10)
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}
