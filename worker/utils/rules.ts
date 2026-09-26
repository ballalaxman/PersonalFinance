import { normalizeTags } from './fingerprint'

export interface RuleRow {
  whenText: string
  thenText: string
}

/**
 * Apply categorization rules to a merchant. Rules are evaluated in the order
 * given (callers pass them oldest first), so a later matching category rule
 * overrides an earlier one. `tag:<name>` rules add a tag instead of changing
 * the category.
 */
export function applyRuleSet(
  rules: RuleRow[],
  merchant: string,
  category: string,
  tags: string[]
): { category: string; tags: string[] } {
  const haystack = merchant.toLowerCase()
  let resultCategory = category
  const resultTags = [...tags]

  for (const rule of rules) {
    const needle = rule.whenText.trim().toLowerCase()
    if (!needle || !haystack.includes(needle)) continue
    const action = rule.thenText.trim()
    if (action.toLowerCase().startsWith('tag:')) {
      resultTags.push(action.slice(4))
    } else if (action) {
      resultCategory = action
    }
  }

  return { category: resultCategory, tags: normalizeTags(resultTags) }
}
