import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { buildFingerprint, normalizeTags } from '../utils/fingerprint'
import { newId, now } from '../utils/id'

export const recurringRoutes = new Hono<{ Bindings: Env }>()

const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  transactionType: z.enum(['expense', 'income', 'investment']),
  category: z.string().trim().min(1).max(100),
  amount: z.number().positive(),
  account: z.string().trim().max(100).optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  active: z.boolean().default(true),
  notifyDaysBefore: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]).default(0),
}).refine((v) => v.cadence !== 'monthly' || v.dayOfMonth !== undefined, {
  message: 'Monthly schedules require dayOfMonth', path: ['dayOfMonth'],
}).refine((v) => !v.endDate || v.endDate >= v.startDate, {
  message: 'End date must not be before start date', path: ['endDate'],
})

recurringRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const [schedules, occurrences] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM recurring_schedules WHERE userId = ?1 ORDER BY nextDueDate ASC')
      .bind(userId).all<Record<string, unknown>>(),
    c.env.DB.prepare("SELECT o.*, s.name AS scheduleName, s.transactionType, s.category, s.account FROM recurring_occurrences o JOIN recurring_schedules s ON s.id = o.scheduleId WHERE o.userId = ?1 ORDER BY o.dueDate DESC LIMIT 200")
      .bind(userId).all<Record<string, unknown>>(),
  ])
  return c.json({
    schedules: (schedules.results ?? []).map((s) => ({ ...s, active: Boolean(s.active) })),
    occurrences: occurrences.results ?? [],
  })
})

recurringRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const parsed = scheduleSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  const data = parsed.data
  const id = newId()
  const ts = now()
  await c.env.DB.prepare(
    'INSERT INTO recurring_schedules (id,userId,name,transactionType,category,amount,account,cadence,startDate,dayOfMonth,nextDueDate,endDate,active,notifyDaysBefore,createdAt,updatedAt) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)'
  ).bind(id, userId, data.name, data.transactionType, data.category, data.amount,
    data.account ?? null, data.cadence, data.startDate, data.dayOfMonth ?? null,
    data.nextDueDate, data.endDate ?? null, data.active ? 1 : 0, data.notifyDaysBefore, ts, ts).run()
  return c.json({ schedule: { id, ...data, createdAt: ts, updatedAt: ts } }, 201)
})

recurringRoutes.patch('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM recurring_schedules WHERE id = ?1 AND userId = ?2')
    .bind(id, userId).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const parsed = scheduleSchema.safeParse({ ...existing, ...(body ?? {}), active: body?.active ?? Boolean(existing.active) })
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  const data = parsed.data
  const ts = now()
  await c.env.DB.prepare(
    'UPDATE recurring_schedules SET name=?1,transactionType=?2,category=?3,amount=?4,account=?5,cadence=?6,startDate=?7,dayOfMonth=?8,nextDueDate=?9,endDate=?10,active=?11,notifyDaysBefore=?12,updatedAt=?13 WHERE id=?14 AND userId=?15'
  ).bind(data.name, data.transactionType, data.category, data.amount, data.account ?? null,
    data.cadence, data.startDate, data.dayOfMonth ?? null, data.nextDueDate,
    data.endDate ?? null, data.active ? 1 : 0, data.notifyDaysBefore, ts, id, userId).run()
  return c.json({ schedule: { id, ...data, createdAt: existing.createdAt, updatedAt: ts } })
})

recurringRoutes.delete('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const result = await c.env.DB.prepare('UPDATE recurring_schedules SET active = 0, updatedAt = ?1 WHERE id = ?2 AND userId = ?3')
    .bind(now(), c.req.param('id'), userId).run()
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
})

const confirmSchema = z.object({
  existingTransactionId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchant: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(['expense', 'income', 'investment']).optional(),
  account: z.string().trim().min(1).optional(),
  tags: z.array(z.string()).default([]),
})

recurringRoutes.post('/occurrences/:id/confirm', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const occurrenceId = c.req.param('id')
  const parsed = confirmSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  const db = c.env.DB
  const occurrence = await db.prepare(
    "SELECT o.*, s.name, s.transactionType, s.category, s.account FROM recurring_occurrences o JOIN recurring_schedules s ON s.id=o.scheduleId WHERE o.id=?1 AND o.userId=?2 AND o.status IN ('pending','postponed')"
  ).bind(occurrenceId, userId).first<Record<string, unknown>>()
  if (!occurrence) return c.json({ error: 'Occurrence is already resolved or does not exist' }, 409)

  if (parsed.data.existingTransactionId) {
    const linked = await db.prepare('SELECT id FROM transactions WHERE id=?1 AND userId=?2')
      .bind(parsed.data.existingTransactionId, userId).first<{ id: string }>()
    if (!linked) return c.json({ error: 'Transaction not found' }, 404)
    const result = await db.prepare("UPDATE recurring_occurrences SET status='confirmed',transactionId=?1,resolvedAt=?2 WHERE id=?3 AND userId=?4 AND status IN ('pending','postponed')")
      .bind(linked.id, now(), occurrenceId, userId).run()
    if (!result.meta.changes) return c.json({ error: 'Occurrence already resolved' }, 409)
    return c.json({ success: true, transactionId: linked.id, linked: true })
  }

  const data = {
    date: parsed.data.date ?? String(occurrence.dueDate),
    merchant: parsed.data.merchant ?? String(occurrence.name),
    category: parsed.data.category ?? String(occurrence.category),
    amount: parsed.data.amount ?? Number(occurrence.expectedAmount),
    type: parsed.data.type ?? String(occurrence.transactionType),
    account: parsed.data.account ?? String(occurrence.account ?? 'Imported account'),
    tags: normalizeTags(parsed.data.tags),
  }
  const fingerprint = buildFingerprint(data.date, data.merchant, data.amount, data.account)
  const duplicate = await db.prepare('SELECT id FROM transactions WHERE userId=?1 AND fingerprint=?2')
    .bind(userId, fingerprint).first<{ id: string }>()
  if (duplicate) return c.json({ error: 'Matching transaction exists', duplicate: true, transactionId: duplicate.id }, 409)

  const transactionId = newId()
  const ts = now()
  const results = await db.batch([
    db.prepare(
      "INSERT INTO transactions (id,userId,date,merchant,category,amount,type,account,tags,receipt,source,fingerprint,createdAt) SELECT ?1,userId,?2,?3,?4,?5,?6,?7,?8,0,'recurring',?9,?10 FROM recurring_occurrences WHERE id=?11 AND userId=?12 AND status IN ('pending','postponed')"
    ).bind(transactionId, data.date, data.merchant, data.category, data.amount, data.type,
      data.account, JSON.stringify(data.tags), fingerprint, ts, occurrenceId, userId),
    db.prepare("UPDATE recurring_occurrences SET status='confirmed',transactionId=?1,resolvedAt=?2 WHERE id=?3 AND userId=?4 AND status IN ('pending','postponed')")
      .bind(transactionId, ts, occurrenceId, userId),
  ])
  if (!results[0].meta.changes || !results[1].meta.changes) return c.json({ error: 'Occurrence already resolved' }, 409)
  return c.json({ success: true, transactionId })
})

recurringRoutes.post('/occurrences/:id/skip', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const result = await c.env.DB.prepare("UPDATE recurring_occurrences SET status='skipped',resolvedAt=?1 WHERE id=?2 AND userId=?3 AND status IN ('pending','postponed')")
    .bind(now(), c.req.param('id'), userId).run()
  if (!result.meta.changes) return c.json({ error: 'Occurrence already resolved or not found' }, 409)
  return c.json({ success: true })
})

recurringRoutes.post('/occurrences/:id/postpone', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const body = await c.req.json().catch(() => null) as { postponedUntil?: string } | null
  if (!body?.postponedUntil || !/^\d{4}-\d{2}-\d{2}$/.test(body.postponedUntil)) {
    return c.json({ error: 'Valid postponedUntil is required' }, 422)
  }
  const result = await c.env.DB.prepare("UPDATE recurring_occurrences SET status='postponed',postponedUntil=?1 WHERE id=?2 AND userId=?3 AND status IN ('pending','postponed')")
    .bind(body.postponedUntil, c.req.param('id'), userId).run()
  if (!result.meta.changes) return c.json({ error: 'Occurrence already resolved or not found' }, 409)
  return c.json({ success: true })
})
