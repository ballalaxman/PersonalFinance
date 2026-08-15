import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { buildFingerprint, normalizeTags } from '../utils/fingerprint'
import { newId, now } from '../utils/id'

export const transactionRoutes = new Hono<{ Bindings: Env }>()

const txSchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().min(1).max(200),
  category: z.string().min(1).default('Needs review'),
  amount:   z.number().positive(),
  type:     z.enum(['expense', 'income']),
  account:  z.string().min(1).default('Imported account'),
  tags:     z.array(z.string()).default([]),
  receipt:  z.boolean().default(false),
  source:   z.string().default('manual'),
})

// Helper: apply only this user's enabled rules
async function applyRules(
  db: Env['DB'],
  userId: string,
  merchant: string,
  category: string
): Promise<string> {
  const rules = await db
    .prepare('SELECT whenText, thenText FROM rules WHERE userId = ?1 AND enabled = 1')
    .bind(userId)
    .all<{ whenText: string; thenText: string }>()

  let cat = category
  for (const rule of rules.results ?? []) {
    if (merchant.toLowerCase().includes(rule.whenText.toLowerCase())) {
      if (!rule.thenText.startsWith('tag:')) cat = rule.thenText
    }
  }
  return cat
}

// ─── POST /api/transactions ───────────────────────────────────────────────────

transactionRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = txSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  }

  const data = parsed.data
  const tags = normalizeTags(data.tags)
  // Fingerprint is scoped per user — same transaction can exist for different users
  const fingerprint = buildFingerprint(data.date, data.merchant, data.amount, data.account)
  const db = c.env.DB

  const existing = await db
    .prepare('SELECT id FROM transactions WHERE userId = ?1 AND fingerprint = ?2')
    .bind(userId, fingerprint)
    .first<{ id: string }>()

  if (existing) return c.json({ error: 'Duplicate transaction', duplicate: true }, 409)

  const category = await applyRules(db, userId, data.merchant, data.category)
  const id = newId()
  const createdAt = now()

  await db
    .prepare(
      'INSERT INTO transactions (id, userId, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)'
    )
    .bind(id, userId, data.date, data.merchant, category, data.amount, data.type, data.account,
      JSON.stringify(tags), data.receipt ? 1 : 0, data.source, fingerprint, createdAt)
    .run()

  return c.json({
    transaction: {
      id, userId, date: data.date, merchant: data.merchant, category,
      amount: data.amount, type: data.type, account: data.account,
      tags, receipt: data.receipt, source: data.source, fingerprint, createdAt,
    }
  }, 201)
})

// ─── POST /api/transactions/batch ────────────────────────────────────────────

transactionRoutes.post('/batch', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: { transactions?: unknown[] }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!Array.isArray(body.transactions)) {
    return c.json({ error: 'transactions array required' }, 400)
  }

  const db = c.env.DB
  let inserted = 0, duplicates = 0, skipped = 0, needsReview = 0
  const errors: string[] = []
  const insertedTxns = []

  for (const item of body.transactions) {
    const parsed = txSchema.safeParse(item)
    if (!parsed.success) {
      skipped++
      errors.push(`Invalid row: ${JSON.stringify(item).slice(0, 80)}`)
      continue
    }

    const data = parsed.data
    const tags = normalizeTags(data.tags)
    const fingerprint = buildFingerprint(data.date, data.merchant, data.amount, data.account)

    const existing = await db
      .prepare('SELECT id FROM transactions WHERE userId = ?1 AND fingerprint = ?2')
      .bind(userId, fingerprint)
      .first<{ id: string }>()

    if (existing) { duplicates++; continue }

    const category = await applyRules(db, userId, data.merchant, data.category)
    if (category === 'Needs review') needsReview++

    const id = newId()
    const createdAt = now()

    try {
      await db
        .prepare(
          'INSERT INTO transactions (id, userId, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt) ' +
          'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)'
        )
        .bind(id, userId, data.date, data.merchant, category, data.amount, data.type,
          data.account, JSON.stringify(tags), data.receipt ? 1 : 0, data.source, fingerprint, createdAt)
        .run()
      inserted++
      insertedTxns.push({ id, userId, ...data, tags, fingerprint, createdAt, category })
    } catch {
      duplicates++ // race condition on unique constraint
    }
  }

  return c.json({ inserted, duplicates, skipped, needsReview, errors, transactions: insertedTxns })
})

// ─── PATCH /api/transactions/:id ─────────────────────────────────────────────

transactionRoutes.patch('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')

  let body: { category?: string; tags?: string[] }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const db = c.env.DB
  const existing = await db
    .prepare('SELECT * FROM transactions WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<Record<string, unknown>>()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const category = body.category ?? (existing.category as string)
  const tags = body.tags !== undefined
    ? normalizeTags(body.tags)
    : JSON.parse(existing.tags as string)

  await db
    .prepare('UPDATE transactions SET category = ?1, tags = ?2 WHERE id = ?3 AND userId = ?4')
    .bind(category, JSON.stringify(tags), id, userId)
    .run()

  return c.json({ transaction: { ...existing, category, tags, receipt: Boolean(existing.receipt) } })
})

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────

transactionRoutes.delete('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')
  const db = c.env.DB

  const existing = await db
    .prepare('SELECT id FROM transactions WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<{ id: string }>()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.prepare('DELETE FROM transactions WHERE id = ?1 AND userId = ?2').bind(id, userId).run()
  return c.json({ success: true })
})
