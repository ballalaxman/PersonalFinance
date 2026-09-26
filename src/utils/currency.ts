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
