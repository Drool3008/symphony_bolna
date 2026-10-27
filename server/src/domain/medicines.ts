import type { Medicine } from '@family-health/shared'
import { addDays, type CalendarDate } from './dates.js'

export interface Cover {
  stock: number
  /** `doses` for an inhaler, from its record; `pills` when the record counts pills_left. */
  unit: string
  days_of_cover: number
  runs_out_on: CalendarDate
}

/**
 * Days of cover: what is left divided by the daily dose, rounded down, as the
 * reference does in set_refill_cycle (server/acting.js). Rounded down because
 * a part-day of tablets is a day she goes without.
 */
export function coverOf(med: Medicine, today: CalendarDate): Cover {
  const stock = med.pills_left ?? med.doses_left ?? 0
  const days = Math.floor(stock / med.daily_dose)
  return {
    stock,
    unit: med.pills_left !== undefined ? 'pills' : (med.unit ?? 'doses'),
    days_of_cover: days,
    runs_out_on: addDays(today, days),
  }
}
