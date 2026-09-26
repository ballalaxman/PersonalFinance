/**
 * Normalize tags: trim, lowercase, remove blanks, deduplicate.
 * Mirrors worker/utils/fingerprint.ts so the UI shows what the server stores.
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
