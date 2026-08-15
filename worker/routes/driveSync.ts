import { Hono } from 'hono'
import type { Env } from '../index'
import { getSettings, upsertSettings } from '../utils/settings'
import { buildFingerprint, normalizeTags } from '../utils/fingerprint'
import { newId, now, safeFilename } from '../utils/id'

export const driveSyncRoutes = new Hono<{ Bindings: Env }>()

// GET /api/drive-sync
driveSyncRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const settings = await getSettings(c.env.DB, userId)
  const syncMeta = (settings.driveSync as Record<string, unknown>) ?? {}

  return c.json({
    folder:           settings.driveFolder ?? null,
    schedule:         { time: '08:00', timezone: 'UTC', cadence: 'daily' },
    lastSyncedAt:     syncMeta.lastSyncedAt ?? null,
    status:           syncMeta.status ?? 'idle',
    imported:         syncMeta.imported ?? 0,
    duplicates:       syncMeta.duplicates ?? 0,
    filesStored:      syncMeta.filesStored ?? 0,
    filesReview:      syncMeta.filesReview ?? 0,
    errors:           syncMeta.errors ?? [],
    processedFileIds: (syncMeta.processedFileIds as string[]) ?? [],
    resetAt:          settings.driveResetAt ?? null,
  })
})

// POST /api/drive-sync — called by the external automation
driveSyncRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  let body: Record<string, unknown>
  try { body = await c.req.json() } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const db = c.env.DB
  const bucket = c.env.BUCKET
  const settings = await getSettings(db, userId)
  const existing = (settings.driveSync as Record<string, unknown>) ?? {}
  const processedFileIds: string[] = [...((existing.processedFileIds as string[]) ?? [])]
  const resetAt: string | null = (settings.driveResetAt as string) ?? null

  const transactions = (body.transactions as unknown[]) ?? []
  const files        = (body.files as unknown[]) ?? []

  let imported = 0, duplicates = 0, filesStored = 0, filesReview = 0
  const errors: string[] = []

  // ── Process transactions ────────────────────────────────────────────────────
  for (const item of transactions) {
    const t = item as Record<string, unknown>
    if (!t.date || !t.merchant || !t.amount) continue
    if (resetAt && t.modifiedTime && String(t.modifiedTime) <= resetAt) continue

    const tags = normalizeTags([...((t.tags as string[]) ?? []), 'Drive import'])
    const fingerprint = buildFingerprint(
      String(t.date), String(t.merchant), Number(t.amount), String(t.account ?? 'Drive import')
    )

    const dup = await db
      .prepare('SELECT id FROM transactions WHERE userId = ?1 AND fingerprint = ?2')
      .bind(userId, fingerprint)
      .first<{ id: string }>()

    if (dup) { duplicates++; continue }

    const id = newId()
    const createdAt = now()
    try {
      await db.prepare(
        'INSERT INTO transactions (id, userId, date, merchant, category, amount, type, account, tags, receipt, source, fingerprint, createdAt) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)'
      ).bind(
        id, userId, t.date, t.merchant,
        t.category ?? 'Needs review',
        Number(t.amount),
        t.type ?? 'expense',
        t.account ?? 'Drive import',
        JSON.stringify(tags),
        t.receipt ? 1 : 0,
        'google-drive',
        fingerprint,
        createdAt
      ).run()
      imported++
    } catch { duplicates++ }
  }

  // ── Process files ───────────────────────────────────────────────────────────
  for (const item of files) {
    const f = item as Record<string, unknown>
    if (!f.fileId || !f.filename) continue
    if (resetAt && f.modifiedTime && String(f.modifiedTime) <= resetAt) continue
    if (processedFileIds.includes(String(f.fileId))) continue

    const id = newId()
    const safe = safeFilename(String(f.filename))
    // Namespace R2 key under userId
    const objectKey = `drive-inbox/${userId}/${safeFilename(String(f.fileId))}-${safe}`
    const createdAt = now()

    try {
      let status = 'stored'
      if (f.content) {
        const bytes = Uint8Array.from(atob(f.content as string), (ch) => ch.charCodeAt(0))
        if (bytes.byteLength > 20 * 1024 * 1024) {
          errors.push(`${f.filename}: exceeds 20 MB`)
          continue
        }
        await bucket.put(objectKey, bytes, {
          httpMetadata: { contentType: String(f.mimeType ?? 'application/octet-stream') },
        })
        if (f.status === 'review') { status = 'review'; filesReview++ }
        else filesStored++
      } else {
        status = 'queued'
        filesStored++
      }

      await db.prepare(
        'INSERT OR IGNORE INTO documents (id, userId, filename, mimeType, size, objectKey, status, source, createdAt) ' +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
      ).bind(id, userId, f.filename, f.mimeType ?? 'application/octet-stream',
        f.size ?? 0, objectKey, status, 'google-drive', createdAt).run()

      processedFileIds.push(String(f.fileId))
    } catch (err) {
      errors.push(`${f.filename}: ${err instanceof Error ? err.message : 'failed'}`)
    }
  }

  // ── Persist updated sync metadata for this user ─────────────────────────────
  const lastSyncedAt = now()
  await upsertSettings(db, userId, {
    driveSync: {
      lastSyncedAt,
      status:           errors.length > 0 ? 'partial' : 'complete',
      imported,
      duplicates,
      filesStored,
      filesReview,
      errors:           errors.slice(0, 20),
      processedFileIds: processedFileIds.slice(-5000),
    },
  })

  return c.json({
    status: errors.length > 0 ? 'partial' : 'complete',
    lastSyncedAt, imported, duplicates, filesStored, filesReview, errors,
  })
})

// POST /api/drive-sync/trigger — manual UI button
driveSyncRoutes.post('/trigger', async (c) => {
  return c.json({ message: 'Drive sync triggered. The next scheduled run will process new files.' })
})
