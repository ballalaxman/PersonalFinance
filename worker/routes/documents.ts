import { Hono } from 'hono'
import type { Env } from '../index'
import { newId, now, safeFilename } from '../utils/id'

export const documentRoutes = new Hono<{ Bindings: Env }>()

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type`)
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
      await bucket.delete(objectKey).catch(() => {})
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
    }
  }

  return c.json({ documents: inserted, errors }, inserted.length > 0 ? 201 : 400)
})

// GET /api/documents/:id/download — stream the private R2 object to its owner
documentRoutes.get('/:id/download', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const doc = await c.env.DB
    .prepare('SELECT filename, mimeType, objectKey FROM documents WHERE id = ?1 AND userId = ?2')
    .bind(c.req.param('id'), userId)
    .first<{ filename: string; mimeType: string; objectKey: string }>()
  if (!doc) return c.json({ error: 'Not found' }, 404)

  const object = await c.env.BUCKET.get(doc.objectKey)
  if (!object) return c.json({ error: 'File is missing from storage' }, 404)

  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      'Content-Type': ALLOWED_TYPES.has(doc.mimeType) ? doc.mimeType : 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safeFilename(doc.filename)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
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
