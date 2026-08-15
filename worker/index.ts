import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { stateRoutes } from './routes/state'
import { transactionRoutes } from './routes/transactions'
import { preferencesRoutes } from './routes/preferences'
import { documentRoutes } from './routes/documents'
import { driveSyncRoutes } from './routes/driveSync'
import { tagRoutes } from './routes/tags'
import { ruleRoutes } from './routes/rules'

export interface Env {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Global middleware ───────────────────────────────────────────────────────

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'OAI-Sites-Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

app.use('*', logger())

// ─── Public routes ───────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

// Auth endpoints — no token required
app.route('/api/auth', authRoutes)

// ─── Protected routes ────────────────────────────────────────────────────────
// requireAuth runs before every handler in these route groups.

app.use('/api/state/*', requireAuth)
app.use('/api/transactions/*', requireAuth)
app.use('/api/preferences/*', requireAuth)
app.use('/api/documents/*', requireAuth)
app.use('/api/drive-sync/*', requireAuth)
app.use('/api/tags/*', requireAuth)
app.use('/api/rules/*', requireAuth)

// Also protect the exact /api/auth/me route (sub-path of /api/auth)
app.use('/api/auth/me', requireAuth)

app.route('/api/state', stateRoutes)
app.route('/api/transactions', transactionRoutes)
app.route('/api/preferences', preferencesRoutes)
app.route('/api/documents', documentRoutes)
app.route('/api/drive-sync', driveSyncRoutes)
app.route('/api/tags', tagRoutes)
app.route('/api/rules', ruleRoutes)

// ─── Fallback ────────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('[Worker error]', err.message)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
