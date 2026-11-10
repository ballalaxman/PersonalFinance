/**
 * Joins lists of names, dropping blanks and repeats and keeping first-seen order.
 * Used so a category or account removed from Settings still shows wherever a
 * transaction uses it.
 */
export function mergeNames(...lists: readonly (string | null | undefined)[][]): string[] {
  return [...new Set(lists.flat().filter((name): name is string => Boolean(name)))]
}
