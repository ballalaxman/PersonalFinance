import { Hono } from 'hono'
import type { Env } from '../index'
import { newId, now, safeFilename } from '../utils/id'

export const documentRoutes = new Hono<{ Bindings: Env }>()

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

// POST /api/documents — multipart upload
documentRoutes.post('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }

  const formData = await c.req.formData()
  const files = formData.getAll('files')

  if (!files.length) return c.json({ error: 'No files provided' }, 400)

  const db = c.env.DB
  const bucket = c.env.BUCKET
  const inserted: unknown[] = []
  const errors: string[] = []

  for (const file of files) {
    if (!(file instanceof File)) continue

    if (file.size > MAX_SIZE) {
      errors.push(`${file.name}: exceeds 20 MB limit`)
      continue
    }

    const id = newId()
    const safe = safeFilename(file.name)
    // R2 key is scoped under the userId so each user's files are namespaced
    const objectKey = `uploads/${userId}/${id}-${safe}`
    const createdAt = now()

    try {
      const bytes = await file.arrayBuffer()
      await bucket.put(objectKey, bytes, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      })

      await db
        .prepare(
          'INSERT INTO documents (id, userId, filename, mimeType, size, objectKey, status, source, createdAt) ' +
          'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
        )
        .bind(id, userId, file.name, file.type || 'application/octet-stream', file.size, objectKey, 'stored', 'upload', createdAt)
        .run()

      inserted.push({ id, filename: file.name, mimeType: file.type, size: file.size, objectKey, status: 'stored', source: 'upload', createdAt })
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
    }
  }

  return c.json({ documents: inserted, errors }, inserted.length > 0 ? 201 : 400)
})

// DELETE /api/documents/:id
documentRoutes.delete('/:id', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const id = c.req.param('id')
  const db = c.env.DB
  const bucket = c.env.BUCKET

  const doc = await db
    .prepare('SELECT objectKey FROM documents WHERE id = ?1 AND userId = ?2')
    .bind(id, userId)
    .first<{ objectKey: string }>()

  if (!doc) return c.json({ error: 'Not found' }, 404)

  await Promise.all([
    bucket.delete(doc.objectKey).catch(() => {}),
    db.prepare('DELETE FROM documents WHERE id = ?1 AND userId = ?2').bind(id, userId).run(),
  ])

  return c.json({ success: true })
})
