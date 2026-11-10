import { Hono } from 'hono'
import type { Env } from '../index'
import { now } from '../utils/id'

export const tagRoutes = new Hono<{ Bindings: Env }>()

// GET /api/tags — every tag with how many of the user's transactions use it
tagRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const rows = await c.env.DB.prepare(
    'SELECT g.name, g.createdAt, (' +
    "SELECT COUNT(*) FROM transactions x, json_each(CASE WHEN json_valid(x.tags) THEN x.tags ELSE '[]' END) j " +
    'WHERE x.userId = g.userId AND j.value = g.name' +
    ') AS usage FROM tags g WHERE g.userId = ?1 ORDER BY g.name ASC'
  ).bind(userId).all<{ name: string; createdAt: string; usage: number }>()
  return c.json({ tags: (rows.results ?? []).map((r) => ({ ...r, usage: Number(r.usage ?? 0) })) })
})

// POST /api/tags
tagRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: { name?: string }
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const name = body.name?.trim().toLowerCase()
  if (!name) return c.json({ error: 'name is required' }, 400)

  const db = c.env.DB
  const createdAt = now()

  try {
    await db
      .prepare('INSERT INTO tags (userId, name, createdAt) VALUES (?1, ?2, ?3)')
      .bind(userId, name, createdAt)
      .run()
  } catch {
    // Already exists for this user — that's fine
  }

  return c.json({ tag: { name, createdAt } }, 201)
})

// DELETE /api/tags/:name
tagRoutes.delete('/:name', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const name = decodeURIComponent(c.req.param('name'))
  const db = c.env.DB

  // Remove tag from all of this user's transactions
  const txns = await db
    .prepare('SELECT id, tags FROM transactions WHERE userId = ?1')
    .bind(userId)
    .all<{ id: string; tags: string }>()

  const stmts = []
  for (const t of txns.results ?? []) {
    let tags: string[]
    try { tags = JSON.parse(t.tags) } catch { continue }
    if (!tags.includes(name)) continue
    const newTags = tags.filter((x) => x !== name)
    stmts.push(
      db.prepare('UPDATE transactions SET tags = ?1 WHERE id = ?2 AND userId = ?3')
        .bind(JSON.stringify(newTags), t.id, userId)
    )
  }

  stmts.push(
    db.prepare('DELETE FROM tags WHERE userId = ?1 AND name = ?2').bind(userId, name)
  )

  await db.batch(stmts)

  return c.json({ success: true })
})
