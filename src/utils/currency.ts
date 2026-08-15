/**
 * Format a number as currency (INR by default).
 */
export function formatCurrency(
  amount: number,
  options: { currency?: string; compact?: boolean } = {}
): string {
  const { currency = 'INR', compact = false } = options

  if (compact && Math.abs(amount) >= 1000) {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
    return formatted
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number as a percentage.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate savings rate safely (avoids division by zero).
 */
export function calcSavingsRate(income: number, spending: number): number {
  if (income <= 0) return 0
  return ((income - spending) / income) * 100
}

/**
 * Convert a recurring amount to monthly equivalent.
 */
export function toMonthlyEquivalent(
  amount: number,
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
): number {
  switch (cadence) {
    case 'weekly':
      return (amount * 52) / 12
    case 'biweekly':
      return (amount * 26) / 12
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'annual':
      return amount / 12
  }
}

/**
 * Parse a financial amount string to a positive number.
 * Handles parenthetical negatives like (100.00) and currency symbols.
 */
export function parseAmount(raw: string): { value: number; isNegative: boolean } | null {
  if (!raw) return null
  const str = raw.trim()

  // Parenthetical negative: (100.00)
  const parenMatch = str.match(/^\(([0-9,]+(?:\.[0-9]+)?)\)$/)
  if (parenMatch) {
    const value = parseFloat(parenMatch[1].replace(/,/g, ''))
    return isNaN(value) ? null : { value, isNegative: true }
  }

  // Remove currency symbols and commas
  const cleaned = str.replace(/[^-0-9.]/g, '')
  const value = parseFloat(cleaned)
  if (isNaN(value)) return null
  return { value: Math.abs(value), isNegative: value < 0 }
}
