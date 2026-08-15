import { Hono } from 'hono'
import type { Env } from '../index'
import { newId, now } from '../utils/id'

export const ruleRoutes = new Hono<{ Bindings: Env }>()

// POST /api/rules
ruleRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: { whenText?: string; thenText?: string; enabled?: boolean }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!body.whenText || !body.thenText) {
    return c.json({ error: 'whenText and thenText are required' }, 400)
  }

  const db = c.env.DB
  const id = newId()
  const createdAt = now()
  const enabled = body.enabled !== false ? 1 : 0

  await db
    .prepare('INSERT INTO rules (id, userId, whenText, thenText, enabled, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(id, userId, body.whenText, body.thenText, enabled, createdAt)
    .run()

  return c.json({
    rule: { id, userId, whenText: body.whenText, thenText: body.thenText, enabled: Boolean(enabled), createdAt }
  }, 201)
})

// PATCH /api/rules/:id
ruleRoutes.patch('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')

  let body: { whenText?: string; thenText?: string; enabled?: boolean }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const db = c.env.DB
  const existing = await db
    .prepare('SELECT * FROM rules WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<Record<string, unknown>>()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const whenText = body.whenText ?? (existing.whenText as string)
  const thenText = body.thenText ?? (existing.thenText as string)
  const enabled  = body.enabled !== undefined
    ? (body.enabled ? 1 : 0)
    : (existing.enabled as number)

  await db
    .prepare('UPDATE rules SET whenText = ?1, thenText = ?2, enabled = ?3 WHERE id = ?4 AND userId = ?5')
    .bind(whenText, thenText, enabled, id, userId)
    .run()

  return c.json({ rule: { ...existing, whenText, thenText, enabled: Boolean(enabled) } })
})

// DELETE /api/rules/:id
ruleRoutes.delete('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')

  const db = c.env.DB
  const existing = await db
    .prepare('SELECT id FROM rules WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<{ id: string }>()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  await db.prepare('DELETE FROM rules WHERE id = ?1 AND userId = ?2').bind(id, userId).run()
  return c.json({ success: true })
})
