import { differenceInDays, parseISO, addDays, addWeeks, addMonths, addQuarters, addYears, isValid } from 'date-fns'
import type { Transaction, RecurringSuggestion, RecurringCadence } from '@/types'
import { normalizeMerchant } from './fingerprint'
import { toMonthlyEquivalent } from './currency'
import {
  SUBSCRIPTION_MERCHANT_HINTS,
  RECURRING_MERCHANT_HINTS,
} from './constants'

interface CadenceWindow {
  cadence: RecurringCadence
  min: number
  max: number
}

const CADENCE_WINDOWS: CadenceWindow[] = [
  { cadence: 'weekly', min: 5, max: 9 },
  { cadence: 'biweekly', min: 12, max: 17 },
  { cadence: 'monthly', min: 24, max: 40 },
  { cadence: 'quarterly', min: 75, max: 110 },
  { cadence: 'annual', min: 330, max: 400 },
]

function classifyCadence(avgInterval: number): RecurringCadence | null {
  for (const { cadence, min, max } of CADENCE_WINDOWS) {
    if (avgInterval >= min && avgInterval <= max) return cadence
  }
  return null
}

function isSubscriptionHint(merchant: string, category: string, tags: string[]): boolean {
  const m = merchant.toLowerCase()
  if (SUBSCRIPTION_MERCHANT_HINTS.some((h) => m.includes(h))) return true
  if (category.toLowerCase().includes('subscription')) return true
  if (tags.some((t) => t.toLowerCase().includes('subscription'))) return true
  return false
}

function isRecurringHint(merchant: string, category: string, tags: string[]): boolean {
  const m = merchant.toLowerCase()
  const c = category.toLowerCase()
  if (RECURRING_MERCHANT_HINTS.some((h) => m.includes(h) || c.includes(h))) return true
  if (tags.some((t) => RECURRING_MERCHANT_HINTS.some((h) => t.toLowerCase().includes(h)))) return true
  return false
}

function calcAmountVariation(amounts: number[]): number {
  if (amounts.length < 2) return 0
  const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length
  const maxDev = Math.max(...amounts.map((a) => Math.abs(a - avg)))
  return avg > 0 ? maxDev / avg : 0
}

function calcIntervalJitter(intervals: number[]): number {
  if (intervals.length < 2) return 0
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
  return Math.max(...intervals.map((v) => Math.abs(v - avg)))
}

function estimateNextDate(lastDate: string, cadence: RecurringCadence): string {
  const d = parseISO(lastDate)
  if (!isValid(d)) return lastDate
  let next: Date
  switch (cadence) {
    case 'weekly': next = addWeeks(d, 1); break
    case 'biweekly': next = addWeeks(d, 2); break
    case 'monthly': next = addMonths(d, 1); break
    case 'quarterly': next = addQuarters(d, 1); break
    case 'annual': next = addYears(d, 1); break
  }
  return next.toISOString().split('T')[0]
}

/**
 * Detect recurring patterns from expense transactions.
 * Returns suggestions that must be explicitly kept or ignored by the user.
 */
export function detectRecurring(
  transactions: Transaction[],
  dismissedPatterns: string[]
): RecurringSuggestion[] {
  const dismissed = new Set(dismissedPatterns)

  // Only expenses
  const expenses = transactions.filter((t) => t.type === 'expense')

  // Group by normalized merchant
  const groups: Record<string, Transaction[]> = {}
  for (const t of expenses) {
    const key = normalizeMerchant(t.merchant)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }

  const suggestions: RecurringSuggestion[] = []

  for (const [normalizedMerchant, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue

    // Sort by date ascending
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))
    const uniqueDates = [...new Set(sorted.map((t) => t.date))].sort()

    if (uniqueDates.length < 2) continue

    // Calculate intervals
    const dates = uniqueDates.map((d) => parseISO(d))
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push(differenceInDays(dates[i], dates[i - 1]))
    }

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const cadence = classifyCadence(avgInterval)
    if (!cadence) continue

    const amounts = sorted.map((t) => t.amount)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const amountVariation = calcAmountVariation(amounts)
    const intervalJitter = calcIntervalJitter(intervals)

    const category = sorted[sorted.length - 1].category
    const tags = sorted[sorted.length - 1].tags

    const isSub = isSubscriptionHint(normalizedMerchant, category, tags)
    const isRec = isRecurringHint(normalizedMerchant, category, tags)

    // Apply variation limits
    const maxVariation = isSub ? 0.20 : 0.35
    if (amountVariation > maxVariation) continue

    // Without a strong hint, require 3+ occurrences and ≤3% variation
    if (!isSub && !isRec) {
      if (uniqueDates.length < 3) continue
      if (amountVariation > 0.03) continue
      // Only suggest monthly/quarterly/annual without hints (protect against grocery noise)
      if (!['monthly', 'quarterly', 'annual'].includes(cadence)) continue
    }

    // Calculate confidence
    const isHighConfidence =
      uniqueDates.length >= 3 && amountVariation <= 0.12 && intervalJitter <= 5

    const key = `${normalizedMerchant}:${cadence}`
    if (dismissed.has(key)) continue

    suggestions.push({
      key,
      merchant: sorted[sorted.length - 1].merchant,
      category,
      cadence,
      averageAmount: Math.round(avgAmount * 100) / 100,
      monthlyEquivalent: Math.round(toMonthlyEquivalent(avgAmount, cadence) * 100) / 100,
      occurrenceCount: uniqueDates.length,
      confidence: isHighConfidence ? 'high' : 'likely',
      nextExpectedDate: estimateNextDate(uniqueDates[uniqueDates.length - 1], cadence),
      isSubscription: isSub,
      transactionIds: sorted.map((t) => t.id),
    })
  }

  // Sort: subscriptions first, then by monthly equivalent descending
  return suggestions.sort((a, b) => {
    if (a.isSubscription !== b.isSubscription) return a.isSubscription ? -1 : 1
    return b.monthlyEquivalent - a.monthlyEquivalent
  })
}
