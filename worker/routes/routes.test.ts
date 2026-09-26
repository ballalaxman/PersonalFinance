// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { recurringRoutes } from './recurring'
import { transactionRoutes } from './transactions'
import { preferencesRoutes } from './preferences'
import { habitRoutes } from './habits'

interface Executed { sql: string; args: unknown[] }

/** Minimal D1 stand-in: `first` answers come from `rows`, every statement is recorded. */
function fakeDb(rows: Record<string, unknown> = {}) {
  const executed: Executed[] = []
  const statement = (sql: string) => {
    let args: unknown[] = []
    const stmt = {
      bind: (...values: unknown[]) => { args = values; return stmt },
      first: async () => { executed.push({ sql, args }); return Object.entries(rows).find(([k]) => sql.includes(k))?.[1] ?? null },
      all: async () => { executed.push({ sql, args }); return { results: [] } },
      run: async () => { executed.push({ sql, args }); return { meta: { changes: 1 } } },
      get sql() { return sql },
      get args() { return args },
    }
    return stmt
  }
  const db = {
    prepare: statement,
    batch: async (stmts: ReturnType<typeof statement>[]) => stmts.map((s) => { executed.push({ sql: s.sql, args: s.args }); return { meta: { changes: 1 } } }),
  }
  return { db, executed }
}

function appWith(path: string, routes: Hono<never>, db: unknown) {
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('user' as never, { id: 'user-1' } as never); await next() })
  app.route(path, routes as never)
  return (url: string, init: RequestInit) => app.request(url, init, { DB: db } as never)
}

const storedSchedule = {
  id: 's1', userId: 'user-1', name: 'Rent', transactionType: 'expense', category: 'Housing', amount: 25000,
  account: null, cadence: 'monthly', startDate: '2026-01-01', dayOfMonth: 1, nextDueDate: '2026-10-01',
  endDate: null, active: 1, notifyDaysBefore: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('PATCH /api/recurring/:id', () => {
  it('updates a schedule whose optional columns are NULL in the database', async () => {
    const { db, executed } = fakeDb({ 'FROM recurring_schedules WHERE id': storedSchedule })
    const request = appWith('/api/recurring', recurringRoutes as never, db)
    const res = await request('/api/recurring/s1', { method: 'PATCH', body: JSON.stringify({ active: false }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(200)
    const update = executed.find((e) => e.sql.startsWith('UPDATE recurring_schedules'))
    expect(update?.args.slice(0, 11)).toEqual(['Rent', 'expense', 'Housing', 25000, null, 'monthly', '2026-01-01', 1, '2026-10-01', null, 0])
  })

  it('clears an optional field the client sends as null', async () => {
    const { db, executed } = fakeDb({ 'FROM recurring_schedules WHERE id': { ...storedSchedule, endDate: '2027-01-01' } })
    const request = appWith('/api/recurring', recurringRoutes as never, db)
    const res = await request('/api/recurring/s1', { method: 'PATCH', body: JSON.stringify({ endDate: null }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(200)
    expect(executed.find((e) => e.sql.startsWith('UPDATE recurring_schedules'))?.args[9]).toBeNull()
  })

  it('rejects impossible dates', async () => {
    const { db } = fakeDb({ 'FROM recurring_schedules WHERE id': storedSchedule })
    const request = appWith('/api/recurring', recurringRoutes as never, db)
    const res = await request('/api/recurring/s1', { method: 'PATCH', body: JSON.stringify({ nextDueDate: '2026-02-30' }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/transactions/:id', () => {
  it('unlinks recurring occurrences before deleting the transaction', async () => {
    const { db, executed } = fakeDb({ 'SELECT id FROM transactions': { id: 't1' } })
    const request = appWith('/api/transactions', transactionRoutes as never, db)
    const res = await request('/api/transactions/t1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const sqls = executed.map((e) => e.sql)
    const unlink = sqls.findIndex((s) => s.startsWith('UPDATE recurring_occurrences SET transactionId = NULL'))
    const del = sqls.findIndex((s) => s.startsWith('DELETE FROM transactions'))
    expect(unlink).toBeGreaterThan(-1)
    expect(del).toBeGreaterThan(unlink)
  })
})

describe('GET /api/transactions search', () => {
  it('escapes LIKE wildcards and declares the escape character', async () => {
    const { db, executed } = fakeDb()
    const request = appWith('/api/transactions', transactionRoutes as never, db)
    await request('/api/transactions?search=50%25_off', { method: 'GET' })
    const query = executed.find((e) => e.sql.includes('LIKE'))
    expect(query?.sql).toContain("ESCAPE '\\'")
    expect(query?.args).toContain('%50\\%\\_off%')
  })
})

describe('PUT /api/preferences', () => {
  it('rejects an invalid timezone', async () => {
    const { db } = fakeDb()
    const request = appWith('/api/preferences', preferencesRoutes as never, db)
    const res = await request('/api/preferences', { method: 'PUT', body: JSON.stringify({ timezone: 'Nowhere/Land' }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(422)
  })

  it('rejects malformed budgets', async () => {
    const { db } = fakeDb()
    const request = appWith('/api/preferences', preferencesRoutes as never, db)
    const res = await request('/api/preferences', { method: 'PUT', body: JSON.stringify({ budgets: [{ id: 'b', category: 'Dining', monthlyLimit: -5, active: true }] }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(422)
  })
})

describe('habits API', () => {
  const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

  it('stores daily habits with a 7-day target regardless of input', async () => {
    const { db, executed } = fakeDb()
    const request = appWith('/api/habits', habitRoutes as never, db)
    const res = await request('/api/habits', { method: 'POST', ...json({ name: 'Read', frequency: 'daily', targetPerWeek: 2 }) })
    expect(res.status).toBe(201)
    expect(executed.find((e) => e.sql.startsWith('INSERT INTO habits'))?.args[6]).toBe(7)
  })

  it('rejects an unknown colour', async () => {
    const { db } = fakeDb()
    const request = appWith('/api/habits', habitRoutes as never, db)
    const res = await request('/api/habits', { method: 'POST', ...json({ name: 'Read', frequency: 'daily', color: 'neon' }) })
    expect(res.status).toBe(422)
  })

  it('refuses check-ins for future dates and impossible dates', async () => {
    const { db } = fakeDb({ 'FROM habits WHERE id': { id: 'h1' } })
    const request = appWith('/api/habits', habitRoutes as never, db)
    expect((await request('/api/habits/h1/logs/2999-01-01', { method: 'PUT' })).status).toBe(422)
    expect((await request('/api/habits/h1/logs/2026-02-30', { method: 'PUT' })).status).toBe(422)
  })

  it('returns 404 when checking in to a habit the user does not own', async () => {
    const { db, executed } = fakeDb()
    const request = appWith('/api/habits', habitRoutes as never, db)
    const res = await request('/api/habits/someone-elses/logs/2026-09-01', { method: 'PUT' })
    expect(res.status).toBe(404)
    expect(executed.some((e) => e.sql.includes('INSERT OR IGNORE INTO habit_logs'))).toBe(false)
  })

  it('scopes check-in writes to the signed-in user', async () => {
    const { db, executed } = fakeDb({ 'FROM habits WHERE id': { id: 'h1' } })
    const request = appWith('/api/habits', habitRoutes as never, db)
    const res = await request('/api/habits/h1/logs/2026-09-01', { method: 'PUT' })
    expect(res.status).toBe(200)
    expect(executed.find((e) => e.sql.includes('INSERT OR IGNORE INTO habit_logs'))?.args.slice(0, 3)).toEqual(['h1', 'user-1', '2026-09-01'])
  })
})
