import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { buildFingerprint, normalizeTags } from '../utils/fingerprint'
import { newId, now } from '../utils/id'
import { decodeTransactionTags, serializeTransaction } from '../utils/transactions'

export const transactionRoutes = new Hono<{ Bindings: Env }>()

const txSchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().min(1).max(200),
  category: z.string().min(1).default('Needs review'),
  amount:   z.number().positive(),
  type:     z.enum(['expense', 'income', 'investment']),
  account:  z.string().min(1).default('Imported account'),
  tags:     z.array(z.string()).default([]),
  receipt:  z.boolean().default(false),
  source:   z.string().default('manual'),
})

const updateTxSchema = txSchema.omit({ source: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required'
)

function encodeCursor(row: { date: string; createdAt: string; id: string }): string {
  return btoa(JSON.stringify([row.date, row.createdAt, row.id]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeCursor(value: string): [string, string, string] | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
    const parsed = JSON.parse(atob(padded))
    return Array.isArray(parsed) && parsed.length === 3 && parsed.every((v) => typeof v === 'string')
      ? parsed as [string, string, string]
      : null
  } catch {
    return null
  }
}

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

// GET /api/transactions — keyset-paginated history
transactionRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const requestedLimit = Number(c.req.query('limit') ?? 50)
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.trunc(requestedLimit))) : 50
  const cursorValue = c.req.query('cursor')
  const cursor = cursorValue ? decodeCursor(cursorValue) : null
  if (cursorValue && !cursor) return c.json({ error: 'Invalid cursor' }, 400)

  const conditions = ['userId = ?']
  const values: unknown[] = [userId]
  const add = (sql: string, value: unknown) => { conditions.push(sql); values.push(value) }

  const account = c.req.query('account')
  const category = c.req.query('category')
  const type = c.req.query('type')
  const search = c.req.query('search')?.trim()
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  if (account) add('account = ?', account)
  if (category) add('category = ?', category)
  if (type) {
    if (!['expense', 'income', 'investment'].includes(type)) return c.json({ error: 'Invalid type' }, 400)
    add('type = ?', type)
  }
  if (startDate) add('date >= ?', startDate)
  if (endDate) add('date <= ?', endDate)
  if (search) {
    conditions.push('(merchant LIKE ? OR category LIKE ? OR tags LIKE ?)')
    const pattern = `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
    values.push(pattern, pattern, pattern)
  }

  const aggregate = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count, ` +
    `COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income, ` +
    `COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense, ` +
    `COALESCE(SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END), 0) AS investment ` +
    `FROM transactions WHERE ${conditions.join(' AND ')}`
  ).bind(...values).first<{ count: number; income: number; expense: number; investment: number }>()

  if (cursor) {
    conditions.push('(date < ? OR (date = ? AND createdAt < ?) OR (date = ? AND createdAt = ? AND id < ?))')
    values.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }

  values.push(limit + 1)
  const result = await c.env.DB.prepare(
    `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ` +
    'ORDER BY date DESC, createdAt DESC, id DESC LIMIT ?'
  ).bind(...values).all<Record<string, unknown>>()

  const rows = result.results ?? []
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit).map(serializeTransaction)
  const lastRow = rows[Math.min(limit, rows.length) - 1]
  const last = lastRow ? {
    date: String(lastRow.date),
    createdAt: String(lastRow.createdAt),
    id: String(lastRow.id),
  } : undefined

  return c.json({
    transactions: page,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    totals: {
      count: Number(aggregate?.count ?? 0),
      income: Number(aggregate?.income ?? 0),
      expense: Number(aggregate?.expense ?? 0),
      investment: Number(aggregate?.investment ?? 0),
    },
  })
})

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

  await db.batch([
    db.prepare(
      'INSERT INTO transactions (id, userId, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)'
    )
    .bind(id, userId, data.date, data.merchant, category, data.amount, data.type, data.account,
      JSON.stringify(tags), data.receipt ? 1 : 0, data.source, fingerprint, createdAt),
    ...tags.map((tag) => db.prepare('INSERT OR IGNORE INTO tags (userId, name, createdAt) VALUES (?1, ?2, ?3)').bind(userId, tag, createdAt)),
  ])

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
  return c.json({ error: 'CSV transaction import is disabled' }, 410)
  /* Legacy implementation retained temporarily for rollback and historical audit.
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

  return c.json({ inserted, duplicates, skipped, needsReview, errors, transactions: insertedTxns }) */
})

// ─── PATCH /api/transactions/:id ─────────────────────────────────────────────

transactionRoutes.patch('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = updateTxSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  }

  const db = c.env.DB
  const existing = await db
    .prepare('SELECT * FROM transactions WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<Record<string, unknown>>()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const data = parsed.data
  const date = data.date ?? String(existing.date)
  const merchant = data.merchant ?? String(existing.merchant)
  const category = data.category ?? String(existing.category)
  const amount = data.amount ?? Number(existing.amount)
  const type = data.type ?? existing.type
  const account = data.account ?? String(existing.account)
  const tags = data.tags !== undefined ? normalizeTags(data.tags) : decodeTransactionTags(existing.tags)
  const receipt = data.receipt ?? Boolean(existing.receipt)
  const fingerprint = buildFingerprint(date, merchant, amount, account)

  const duplicate = await db.prepare(
    'SELECT id FROM transactions WHERE userId = ?1 AND fingerprint = ?2 AND id <> ?3'
  ).bind(userId, fingerprint, id).first<{ id: string }>()
  if (duplicate) return c.json({ error: 'Duplicate transaction', duplicate: true }, 409)

  try {
    await db.batch([
      db.prepare(
      'UPDATE transactions SET date = ?1, merchant = ?2, category = ?3, amount = ?4, type = ?5, account = ?6, tags = ?7, receipt = ?8, fingerprint = ?9 WHERE id = ?10 AND userId = ?11'
      ).bind(date, merchant, category, amount, type, account, JSON.stringify(tags), receipt ? 1 : 0, fingerprint, id, userId),
      ...tags.map((tag) => db.prepare('INSERT OR IGNORE INTO tags (userId, name, createdAt) VALUES (?1, ?2, ?3)').bind(userId, tag, now())),
    ])
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      return c.json({ error: 'Duplicate transaction', duplicate: true }, 409)
    }
    throw error
  }

  return c.json({ transaction: serializeTransaction({ ...existing, date, merchant, category, amount, type, account, tags, receipt, fingerprint }) })
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
