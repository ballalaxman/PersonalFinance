export function decodeTransactionTags(value: unknown): string[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return [...new Set(parsed.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

export function serializeTransaction(row: Record<string, unknown>) {
  return {
    ...row,
    receipt: Boolean(row.receipt),
    tags: decodeTransactionTags(row.tags),
  }
}
