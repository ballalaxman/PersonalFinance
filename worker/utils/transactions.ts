export function decodeTransactionTags(value: unknown): string[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return [...new Set(parsed.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

/**
 * Column list for `FROM transactions t`: every transaction column plus the id
 * of the receipt file attached to it (null when there is none).
 */
export const TX_COLUMNS =
  't.*, (SELECT r.documentId FROM transaction_receipts r WHERE r.transactionId = t.id) AS receiptDocumentId'

export function serializeTransaction(row: Record<string, unknown>) {
  return {
    ...row,
    receipt: Boolean(row.receipt),
    tags: decodeTransactionTags(row.tags),
  }
}
