import type { D1Database } from '@cloudflare/workers-types'

const DEFAULT_SETTINGS = {
  categories: [
    'Housing', 'Groceries', 'Shopping', 'Dining', 'Transportation',
    'Utilities', 'Subscriptions', 'Insurance', 'Health', 'Entertainment',
    'Income', 'Needs review', 'Other',
    'Mutual Fund SIP', 'EPF', 'PPF', 'Stocks', 'Fixed Deposit', 'Bonds',
    'Investment Income', 'Other Investment',
  ],
  accounts: ['Main Checking', 'Everyday Visa', 'Rewards Card', 'Cash'],
  goals: [],
  budgets: [],
  subscriptions: [],
  recurring: [],
  dismissedPatterns: [],
  assets: 0,
  liabilities: 0,
  netWorthConfigured: false,
  selectedPeriod: 'this-month',
  timezone: 'Asia/Kolkata',
}

/**
 * Read all settings for a specific user.
 * Falls back to DEFAULT_SETTINGS for any key not yet stored.
 */
export async function getSettings(
  db: D1Database,
  userId: string
): Promise<Record<string, unknown>> {
  const rows = await db
    .prepare('SELECT key, value FROM settings WHERE userId = ?1')
    .bind(userId)
    .all<{ key: string; value: string }>()

  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS }

  for (const row of rows.results ?? []) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }

  return result
}

/**
 * Upsert one or more settings keys for a specific user.
 */
export async function upsertSettings(
  db: D1Database,
  userId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const ts = new Date().toISOString()
  const stmts = Object.entries(patch).map(([key, value]) =>
    db
      .prepare(
        'INSERT INTO settings (userId, key, value, updatedAt) VALUES (?1, ?2, ?3, ?4) ' +
        'ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt'
      )
      .bind(userId, key, JSON.stringify(value), ts)
  )
  if (stmts.length > 0) await db.batch(stmts)
}

/**
 * Seed empty default state for a brand-new user.
 */
export async function initEmptyState(db: D1Database, userId: string): Promise<void> {
  await upsertSettings(db, userId, {
    categories: DEFAULT_SETTINGS.categories,
    accounts: DEFAULT_SETTINGS.accounts,
    goals: [],
    budgets: [],
    subscriptions: [],
    recurring: [],
    dismissedPatterns: [],
    assets: 0,
    liabilities: 0,
    netWorthConfigured: false,
    selectedPeriod: 'this-month',
    timezone: DEFAULT_SETTINGS.timezone,
  })
}
