import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
  format,
  isValid,
} from 'date-fns'
import type { DatePeriod } from '@/types'

export interface DateRange {
  start: Date
  end: Date
}

/**
 * Get date range for a given period.
 * Returns null for 'all-time' (no filter).
 */
export function getDateRange(period: DatePeriod): DateRange | null {
  const now = new Date()

  switch (period) {
    case 'all-time':
      return null
    case 'this-month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'last-month': {
      const last = subMonths(now, 1)
      return { start: startOfMonth(last), end: endOfMonth(last) }
    }
    case 'last-3-months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    case 'last-6-months':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }
    case 'this-year':
      return { start: startOfYear(now), end: endOfYear(now) }
    default:
      return null
  }
}

/**
 * Filter an array of transactions by period.
 */
export function filterByPeriod<T extends { date: string }>(
  items: T[],
  period: DatePeriod
): T[] {
  const range = getDateRange(period)
  if (!range) return items

  return items.filter((item) => {
    const d = parseISO(item.date)
    return isValid(d) && isWithinInterval(d, { start: range.start, end: range.end })
  })
}

/**
 * Format date string for display.
 */
export function formatDate(dateStr: string, fmt = 'MMM d, yyyy'): string {
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? format(d, fmt) : dateStr
  } catch {
    return dateStr
  }
}

/**
 * Format date to YYYY-MM-DD.
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Get today as YYYY-MM-DD.
 */
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Current month in the browser's local timezone, formatted as YYYY-MM. */
export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function monthDateRange(month: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error('Invalid month')
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) throw new Error('Invalid month')
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { startDate: `${match[1]}-${match[2]}-01`, endDate: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}` }
}

/**
 * Get human-readable label for a period.
 */
export const PERIOD_LABELS: Record<DatePeriod, string> = {
  'all-time': 'All time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'last-6-months': 'Last 6 months',
  'this-year': 'This year',
}

export const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'all-time', label: 'All time' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'last-6-months', label: 'Last 6 months' },
  { value: 'this-year', label: 'This year' },
]
