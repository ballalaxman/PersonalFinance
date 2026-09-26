import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { getSettings, upsertSettings } from '../utils/settings'
import { isValidTimezone } from '../utils/validation'

export const preferencesRoutes = new Hono<{ Bindings: Env }>()

const label = z.string().trim().min(1).max(100)

// Allowlist with per-key validation — prevents arbitrary or malformed writes
const preferencesSchema = z.object({
  categories: z.array(label).max(200),
  accounts: z.array(label).max(100),
  goals: z.array(z.object({
    id: z.string().min(1).max(64),
    name: label,
    targetAmount: z.number().positive(),
    currentSavedAmount: z.number().min(0),
    dueDate: z.string().max(10).optional(),
    note: z.string().max(500).optional(),
  })).max(200),
  budgets: z.array(z.object({
    id: z.string().min(1).max(64),
    category: label,
    monthlyLimit: z.number().positive(),
    active: z.boolean(),
  })).max(200),
  selectedPeriod: z.enum(['this-month', 'last-month', 'last-quarter', 'last-6-months', 'this-year', 'specific-month']),
  selectedMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  timezone: z.string().refine(isValidTimezone, 'Must be a valid IANA timezone'),
}).partial().strip()

// PUT /api/preferences — upsert settings for the authenticated user
preferencesRoutes.put('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = preferencesSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  }

  const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))
  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'No valid keys provided' }, 400)
  }

  const db = c.env.DB
  await upsertSettings(db, userId, patch)
  const settings = await getSettings(db, userId)

  return c.json({ settings })
})
