import type { RecurringTest } from '@family-health/shared'
import { addDays, daysBetween, type CalendarDate } from './dates.js'

export interface Due {
  next_due: CalendarDate
  /** Negative once the date has passed. */
  days_until_due: number
  overdue: boolean
}

/** Next due is the last time it was done plus its interval. An overdue test stays overdue; it is not clamped. */
export function dueOf(test: RecurringTest, today: CalendarDate): Due {
  const next_due = addDays(test.last_done, test.every_days)
  const days_until_due = daysBetween(today, next_due)
  return { next_due, days_until_due, overdue: days_until_due < 0 }
}
