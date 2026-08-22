import { Hono } from 'hono'
import type { Env } from '../index'
import { serializeTransaction } from '../utils/transactions'
import { getSettings, initEmptyState, upsertSettings } from '../utils/settings'
import { migrateLegacyRecurringSettings } from '../utils/legacyMigration'

export const stateRoutes = new Hono<{ Bindings: Env }>()

// ─── GET /api/state ───────────────────────────────────────────────────────────

stateRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const db = c.env.DB
  await migrateLegacyRecurringSettings(db, userId)

  const [txResult, tagResult, ruleResult, docResult, scheduleResult, occurrenceResult, settings] = await Promise.all([
    db
      .prepare('SELECT * FROM transactions WHERE userId = ?1 ORDER BY date DESC, createdAt DESC LIMIT 50')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT name, createdAt FROM tags WHERE userId = ?1 ORDER BY name ASC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT * FROM rules WHERE userId = ?1 ORDER BY createdAt DESC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT * FROM documents WHERE userId = ?1 ORDER BY createdAt DESC LIMIT 100')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT * FROM recurring_schedules WHERE userId = ?1 ORDER BY nextDueDate ASC')
      .bind(userId)
      .all<Record<string, unknown>>(),
    db
      .prepare("SELECT o.*, s.name AS scheduleName FROM recurring_occurrences o JOIN recurring_schedules s ON s.id = o.scheduleId WHERE o.userId = ?1 AND o.status IN ('pending', 'postponed') ORDER BY COALESCE(o.postponedUntil, o.dueDate) ASC LIMIT 100")
      .bind(userId)
      .all<Record<string, unknown>>(),
    getSettings(db, userId),
  ])

  const transactions = (txResult.results ?? []).map(serializeTransaction)

  const rules = (ruleResult.results ?? []).map((r) => ({
    ...r,
    enabled: Boolean(r.enabled),
  }))

  return c.json({
    transactions,
    tags: tagResult.results ?? [],
    rules,
    settings,
    documents: docResult.results ?? [],
    recurringSchedules: (scheduleResult.results ?? []).map((s) => ({ ...s, active: Boolean(s.active) })),
    recurringOccurrences: occurrenceResult.results ?? [],
    pendingRecurringCount: (occurrenceResult.results ?? []).length,
  })
})

// ─── DELETE /api/state — wipe only the current user's data ───────────────────

stateRoutes.delete('/', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.confirmation !== 'DELETE ALL FINTRACK DATA') {
    return c.json({ error: 'Invalid confirmation' }, 400)
  }

  const { id: userId } = c.get('user' as never) as { id: string }
  const db = c.env.DB
  const bucket = c.env.BUCKET

  // Fetch this user's document keys before deleting rows
  const docRows = await db
    .prepare('SELECT objectKey FROM documents WHERE userId = ?1')
    .bind(userId)
    .all<{ objectKey: string }>()

  // Delete all this user's D1 records
  // CASCADE on FK handles child rows, but we delete explicitly for clarity
  await db.batch([
    db.prepare('DELETE FROM recurring_occurrences WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM recurring_schedules   WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM push_subscriptions    WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM transactions WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM documents    WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM rules        WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM tags         WHERE userId = ?1').bind(userId),
    db.prepare('DELETE FROM settings     WHERE userId = ?1').bind(userId),
  ])

  // Delete this user's R2 objects
  try {
    const keys = (docRows.results ?? []).map((d) => d.objectKey)
    await Promise.all(keys.map((k) => bucket.delete(k).catch(() => {})))
  } catch {
    // R2 failure must not block the wipe response
  }

  // Re-seed empty defaults for this user
  await initEmptyState(db, userId)

  const ts = new Date().toISOString()
  await upsertSettings(db, userId, {
    freshStart: true,
    driveResetAt: ts,
    selectedPeriod: 'this-month',
  })

  return c.json({ success: true, driveResetAt: ts })
})
