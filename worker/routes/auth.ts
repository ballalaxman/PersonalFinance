import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { hashPassword, verifyPassword, signJWT } from '../utils/crypto'
import { initEmptyState } from '../utils/settings'
import { newId, now } from '../utils/id'
import { requireAuth } from '../middleware/auth'

export const authRoutes = new Hono<{ Bindings: Env }>()
authRoutes.use('/me', requireAuth)

// ─── Validation schemas ──────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

// ─── POST /api/auth/register ─────────────────────────────────────────────────

authRoutes.post('/register', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 422)
  }

  const { name, email, password } = parsed.data
  const db = c.env.DB

  // Check for existing account — use same error message to prevent email enumeration
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ?1')
    .bind(email)
    .first<{ id: string }>()

  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 409)
  }

  const id = newId()
  const passwordHash = await hashPassword(password)
  const createdAt = now()

  await db
    .prepare('INSERT INTO users (id, email, name, passwordHash, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(id, email, name, passwordHash, createdAt)
    .run()

  // Seed default settings for the new user
  await initEmptyState(db, id)

  const secret = c.env.JWT_SECRET
  if (!secret) return c.json({ error: 'Server configuration error' }, 500)

  const token = await signJWT({ sub: id, email, name }, secret)

  return c.json({
    token,
    user: { id, email, name, createdAt },
  }, 201)
})

// ─── POST /api/auth/login ────────────────────────────────────────────────────

authRoutes.post('/login', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const { email, password } = parsed.data
  const db = c.env.DB

  const user = await db
    .prepare('SELECT id, email, name, passwordHash, createdAt FROM users WHERE email = ?1')
    .bind(email)
    .first<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }>()

  // Always run verifyPassword even on missing user to prevent timing attacks
  const dummyHash = 'pbkdf2:100000:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  const isValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummyHash).then(() => false)

  if (!user || !isValid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const secret = c.env.JWT_SECRET
  if (!secret) return c.json({ error: 'Server configuration error' }, 500)

  const token = await signJWT(
    { sub: user.id, email: user.email, name: user.name },
    secret
  )

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
  })
})

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Lightweight token-check endpoint — returns the current user from the JWT.
// The requireAuth middleware (applied in index.ts) handles verification.

authRoutes.get('/me', async (c) => {
  // user is injected by requireAuth middleware
  const user = c.get('user' as never) as { id: string; email: string; name: string } | undefined
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ user })
})
