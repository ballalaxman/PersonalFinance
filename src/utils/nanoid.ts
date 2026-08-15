/**
 * Tiny nanoid-style ID generator using crypto.randomUUID() with dashes stripped.
 */
export function nanoid(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
