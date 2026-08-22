import { Hono } from 'hono'
import type { Env } from '../index'
import { getSettings, upsertSettings } from '../utils/settings'

export const preferencesRoutes = new Hono<{ Bindings: Env }>()

// PUT /api/preferences — upsert settings for the authenticated user
preferencesRoutes.put('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: Record<string, unknown>
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  // Allowlist — prevent arbitrary writes
  const ALLOWED = new Set([
    'categories', 'accounts', 'goals', 'budgets',
    'dismissedPatterns',
    'selectedPeriod', 'selectedMonth', 'timezone', 'freshStart',
  ])

  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) patch[k] = v
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'No valid keys provided' }, 400)
  }

  const db = c.env.DB
  await upsertSettings(db, userId, patch)
  const settings = await getSettings(db, userId)

  return c.json({ settings })
})
