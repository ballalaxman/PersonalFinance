import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { verifyJWT } from '../utils/crypto'

/**
 * requireAuth — Hono middleware that validates the Bearer JWT.
 *
 * On success: sets `user` on the context and calls next().
 * On failure: returns 401 immediately.
 *
 * Usage:
 *   app.use('/api/state/*', requireAuth)
 *   app.use('/api/transactions/*', requireAuth)
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7).trim()

  const secret = c.env.JWT_SECRET
  if (!secret) {
    console.error('[requireAuth] JWT_SECRET not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  const payload = await verifyJWT(token, secret)
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Make user info available to route handlers via c.get('user')
  c.set('user' as never, { id: payload.sub, email: payload.email, name: payload.name })

  await next()
}
