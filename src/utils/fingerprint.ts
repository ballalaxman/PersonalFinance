/**
 * Generate a duplicate-detection fingerprint for a transaction.
 *
 * Format: date|merchant|amount|account
 * Example: 2026-08-09|netflix|15.99|everyday visa
 *
 * This is a deterministic client-side preview — the server recalculates
 * and enforces uniqueness via a UNIQUE constraint in D1.
 */
export function generateFingerprint(
  date: string,
  merchant: string,
  amount: number,
  account: string
): string {
  const parts = [
    date.trim(),
    merchant.trim().toLowerCase(),
    amount.toFixed(2),
    account.trim().toLowerCase(),
  ]
  return parts.join('|')
}

/**
 * Normalize tags: trim, lowercase, remove blanks, deduplicate.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags
    .map((t) => t.trim().toLowerCase())
    .filter((t) => {
      if (!t || seen.has(t)) return false
      seen.add(t)
      return true
    })
}

/**
 * Normalize merchant name for recurring detection:
 * - lowercase and trim
 * - remove punctuation except spaces and hyphens
 * - remove trailing # + digits (e.g. "Starbucks #1234" → "starbucks")
 * - collapse whitespace
 * - remove long digit sequences (reference numbers)
 */
export function normalizeMerchant(merchant: string): string {
  return merchant
    .toLowerCase()
    .trim()
    .replace(/#\d+\s*$/, '')         // trailing #1234
    .replace(/\d{6,}/g, '')          // long digit sequences
    .replace(/[^\w\s-]/g, '')        // punctuation
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim()
}
