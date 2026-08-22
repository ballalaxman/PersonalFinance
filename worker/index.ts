import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { D1Database, R2Bucket, ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { stateRoutes } from './routes/state'
import { transactionRoutes } from './routes/transactions'
import { preferencesRoutes } from './routes/preferences'
import { documentRoutes } from './routes/documents'
import { tagRoutes } from './routes/tags'
import { ruleRoutes } from './routes/rules'
import { recurringRoutes } from './routes/recurring'
import { processDueSchedules } from './scheduled'
import { pushRoutes } from './routes/push'
import { dashboardRoutes } from './routes/dashboard'

export interface Env {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
  APP_ORIGIN?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
}

const app = new Hono<{ Bindings: Env }>()

// ─── Global middleware ───────────────────────────────────────────────────────

app.use('*', cors({
  origin: (origin, c) => origin === (c.env.APP_ORIGIN ?? 'http://localhost:5173') ? origin : '',
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

for (const path of ['state', 'dashboard', 'transactions', 'preferences', 'documents', 'tags', 'rules', 'recurring', 'push']) {
  app.use(`/api/${path}`, requireAuth)
  app.use(`/api/${path}/*`, requireAuth)
}

app.route('/api/state', stateRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/transactions', transactionRoutes)
app.route('/api/preferences', preferencesRoutes)
app.route('/api/documents', documentRoutes)
app.route('/api/tags', tagRoutes)
app.route('/api/rules', ruleRoutes)
app.route('/api/recurring', recurringRoutes)
app.route('/api/push', pushRoutes)

// ─── Fallback ────────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('[Worker error]', err.message)
  return c.json({ error: 'Internal server error' }, 500)
})

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processDueSchedules(env))
  },
}
