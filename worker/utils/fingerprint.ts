export function buildFingerprint(
  date: string,
  merchant: string,
  amount: number,
  account: string
): string {
  return [
    date.trim(),
    merchant.trim().toLowerCase(),
    amount.toFixed(2),
    account.trim().toLowerCase(),
  ].join('|')
}

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
