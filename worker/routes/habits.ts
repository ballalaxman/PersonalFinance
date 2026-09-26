import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { newId, now } from '../utils/id'
import { isCalendarDate, isoDate } from '../utils/validation'

export const habitRoutes = new Hono<{ Bindings: Env }>()

export const HABIT_COLORS = ['violet', 'emerald', 'sky', 'amber', 'rose', 'slate'] as const

const habitSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).default(''),
  color: z.enum(HABIT_COLORS).default('violet'),
  frequency: z.enum(['daily', 'weekly']),
  // Weekly habits: how many days per week count as "done". Daily habits are always 7.
  targetPerWeek: z.number().int().min(1).max(7).default(7),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
})

type HabitRow = Record<string, unknown> & { archived: number; targetPerWeek: number; frequency: string }

function serializeHabit(row: HabitRow) {
  return { ...row, archived: Boolean(row.archived) }
}

function normalize(data: z.infer<typeof habitSchema>) {
  return { ...data, targetPerWeek: data.frequency === 'daily' ? 7 : data.targetPerWeek }
}

/** Latest date a check-in may use: tomorrow in UTC covers every user timezone. */
function latestAllowedDate(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// GET /api/habits?from=YYYY-MM-DD&to=YYYY-MM-DD — habits plus check-ins in range (default: last 400 days)
habitRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const from = c.req.query('from') ?? daysAgo(400)
  const to = c.req.query('to') ?? latestAllowedDate()
  if (!isCalendarDate(from) || !isCalendarDate(to)) return c.json({ error: 'Invalid date range' }, 400)

  const [habits, logs] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM habits WHERE userId = ?1 ORDER BY archived ASC, sortOrder ASC, createdAt ASC')
      .bind(userId).all<HabitRow>(),
    c.env.DB.prepare('SELECT habitId, date FROM habit_logs WHERE userId = ?1 AND date >= ?2 AND date <= ?3 ORDER BY date ASC')
      .bind(userId, from, to).all<{ habitId: string; date: string }>(),
  ])

  return c.json({ habits: (habits.results ?? []).map(serializeHabit), logs: logs.results ?? [] })
})

habitRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const parsed = habitSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  const data = normalize(parsed.data)
  const id = newId()
  const ts = now()
  await c.env.DB.prepare(
    'INSERT INTO habits (id,userId,name,description,color,frequency,targetPerWeek,archived,sortOrder,createdAt,updatedAt) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)'
  ).bind(id, userId, data.name, data.description, data.color, data.frequency, data.targetPerWeek,
    data.archived ? 1 : 0, data.sortOrder, ts, ts).run()
  return c.json({ habit: { id, ...data, createdAt: ts, updatedAt: ts } }, 201)
})

habitRoutes.patch('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?1 AND userId = ?2')
    .bind(id, userId).first<HabitRow>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const parsed = habitSchema.safeParse({ ...existing, archived: Boolean(existing.archived), ...(body ?? {}) })
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  const data = normalize(parsed.data)
  const ts = now()
  await c.env.DB.prepare(
    'UPDATE habits SET name=?1,description=?2,color=?3,frequency=?4,targetPerWeek=?5,archived=?6,sortOrder=?7,updatedAt=?8 WHERE id=?9 AND userId=?10'
  ).bind(data.name, data.description, data.color, data.frequency, data.targetPerWeek,
    data.archived ? 1 : 0, data.sortOrder, ts, id, userId).run()
  return c.json({ habit: { id, ...data, createdAt: existing.createdAt, updatedAt: ts } })
})

// Deletes the habit and its whole history (habit_logs cascade). Archive to keep history.
habitRoutes.delete('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const result = await c.env.DB.prepare('DELETE FROM habits WHERE id = ?1 AND userId = ?2')
    .bind(c.req.param('id'), userId).run()
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
})

const logParams = z.object({ id: z.string().min(1), date: isoDate })

// PUT /api/habits/:id/logs/:date — mark done (idempotent)
habitRoutes.put('/:id/logs/:date', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const params = logParams.safeParse(c.req.param())
  if (!params.success) return c.json({ error: 'Invalid date' }, 422)
  if (params.data.date > latestAllowedDate()) return c.json({ error: 'Cannot check in for a future date' }, 422)

  const habit = await c.env.DB.prepare('SELECT id FROM habits WHERE id = ?1 AND userId = ?2')
    .bind(params.data.id, userId).first<{ id: string }>()
  if (!habit) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare('INSERT OR IGNORE INTO habit_logs (habitId, userId, date, createdAt) VALUES (?1, ?2, ?3, ?4)')
    .bind(params.data.id, userId, params.data.date, now()).run()
  return c.json({ success: true, habitId: params.data.id, date: params.data.date })
})

// DELETE /api/habits/:id/logs/:date — undo a check-in (idempotent)
habitRoutes.delete('/:id/logs/:date', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const params = logParams.safeParse(c.req.param())
  if (!params.success) return c.json({ error: 'Invalid date' }, 422)
  await c.env.DB.prepare('DELETE FROM habit_logs WHERE habitId = ?1 AND userId = ?2 AND date = ?3')
    .bind(params.data.id, userId, params.data.date).run()
  return c.json({ success: true })
})
