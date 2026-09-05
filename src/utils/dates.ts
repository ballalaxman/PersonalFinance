import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subQuarters,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
  format,
  isValid,
  addMonths,
} from 'date-fns'
import type { DatePeriod } from '@/types'

export interface DateRange {
  start: Date
  end: Date
}

// ─── Named period → DateRange ─────────────────────────────────────────────────

/**
 * Convert a named DatePeriod into an absolute { start, end } range.
 * 'specific-month' is NOT handled here — use resolveDashboardRange() instead.
 */
export function getDateRange(period: DatePeriod): DateRange {
  const now = new Date()

  switch (period) {
    case 'this-month':
      return { start: startOfMonth(now), end: endOfMonth(now) }

    case 'last-month': {
      const last = subMonths(now, 1)
      return { start: startOfMonth(last), end: endOfMonth(last) }
    }

    case 'last-quarter': {
      // The fully completed previous calendar quarter (e.g. Apr–Jun if current is Jul–Sep)
      const prev = subQuarters(now, 1)
      return { start: startOfQuarter(prev), end: endOfQuarter(prev) }
    }

    case 'last-6-months':
      // Rolling: start of the month 5 months ago → end of this month
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }

    case 'this-year':
      return { start: startOfYear(now), end: endOfYear(now) }

    case 'specific-month':
    default:
      // Fallback to this month — caller should use resolveDashboardRange() for specific-month
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

// ─── Unified resolver used by Dashboard ──────────────────────────────────────

/**
 * Resolve the correct { startDate, endDate } strings (YYYY-MM-DD) for the
 * dashboard API call, given the current period and selected month.
 *
 *   period === 'specific-month'  →  derive from selectedMonth (YYYY-MM)
 *   anything else                →  derive from getDateRange(period)
 */
export function resolveDashboardRange(
  period: DatePeriod,
  selectedMonth: string
): { startDate: string; endDate: string } {
  if (period === 'specific-month') {
    return monthDateRange(selectedMonth)
  }
  const range = getDateRange(period)
  return { startDate: toISODate(range.start), endDate: toISODate(range.end) }
}

// ─── Month helpers ────────────────────────────────────────────────────────────

/**
 * Convert a YYYY-MM string to { startDate, endDate } in YYYY-MM-DD format.
 */
export function monthDateRange(month: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error(`Invalid month: ${month}`)
  const year = Number(match[1])
  const mon  = Number(match[2])
  if (mon < 1 || mon > 12) throw new Error(`Invalid month: ${month}`)
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return {
    startDate: `${match[1]}-${match[2]}-01`,
    endDate:   `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  }
}

/**
 * Shift a YYYY-MM string forward (+) or backward (-) by `delta` months.
 */
export function shiftMonth(month: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  const shifted = addMonths(new Date(Number(match[1]), Number(match[2]) - 1, 1), delta)
  return format(shifted, 'yyyy-MM')
}

// ─── Client-side filter helper ────────────────────────────────────────────────

/**
 * Filter an array of dated items by a DatePeriod.
 * Used for client-side filtering on non-dashboard pages.
 */
export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: DatePeriod,
  selectedMonth?: string
): T[] {
  let range: DateRange

  if (period === 'specific-month' && selectedMonth) {
    const { startDate, endDate } = monthDateRange(selectedMonth)
    range = { start: parseISO(startDate), end: parseISO(endDate) }
  } else {
    range = getDateRange(period)
  }

  return items.filter((item) => {
    const d = parseISO(item.date)
    return isValid(d) && isWithinInterval(d, { start: range.start, end: range.end })
  })
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatDate(dateStr: string, fmt = 'MMM d, yyyy'): string {
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? format(d, fmt) : dateStr
  } catch {
    return dateStr
  }
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Current month as YYYY-MM in local timezone. */
export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

/** Human-readable label for a YYYY-MM string, e.g. "September 2026". */
export function formatMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  try {
    return format(new Date(Number(match[1]), Number(match[2]) - 1, 1), 'MMMM yyyy')
  } catch {
    return month
  }
}

// ─── Period metadata ──────────────────────────────────────────────────────────

export const PERIOD_LABELS: Record<DatePeriod, string> = {
  'this-month':     'This month',
  'last-month':     'Last month',
  'last-quarter':   'Last quarter',
  'last-6-months':  'Last 6 months',
  'this-year':      'This year',
  'specific-month': 'Specific month',
}

export const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'this-month',     label: 'This month'    },
  { value: 'last-month',     label: 'Last month'    },
  { value: 'last-quarter',   label: 'Last quarter'  },
  { value: 'last-6-months',  label: 'Last 6 months' },
  { value: 'this-year',      label: 'This year'     },
  { value: 'specific-month', label: 'Specific month' },
]
