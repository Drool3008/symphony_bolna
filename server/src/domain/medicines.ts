import type { Medicine } from '@family-health/shared'
import { addDays, daysBetween, type CalendarDate } from './dates.js'

export interface Cover {
  /** What the record holds, counted on `stock_as_of`. */
  stock: number
  /** `doses` for an inhaler, from its record; `pills` when the record counts pills_left. */
  unit: string
  stock_as_of: CalendarDate
  /** Whole days from today until it runs out; zero once it has. */
  days_of_cover: number
  runs_out_on: CalendarDate
}

/**
 * Days of cover: what is left divided by the daily dose, rounded down, as the
 * reference does in set_refill_cycle (server/acting.js). Rounded down because
 * a part-day of tablets is a day she goes without.
 *
 * The count is anchored to the day it was taken (`asOf`: the sim clock start
 * for onboarding data), so the run-out date stays put and the days left count
 * down as the clock moves.
 */
export function coverOf(med: Medicine, today: CalendarDate, asOf: CalendarDate): Cover {
  const stock = med.pills_left ?? med.doses_left ?? 0
  const runs_out_on = addDays(asOf, Math.floor(stock / med.daily_dose))
  return {
    stock,
    unit: med.pills_left !== undefined ? 'pills' : (med.unit ?? 'doses'),
    stock_as_of: asOf,
    days_of_cover: Math.max(0, daysBetween(today, runs_out_on)),
    runs_out_on,
  }
}
