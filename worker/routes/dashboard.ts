import { Hono } from 'hono'
import type { Env } from '../index'
import { serializeTransaction } from '../utils/transactions'

export const dashboardRoutes = new Hono<{ Bindings: Env }>()

dashboardRoutes.get('/', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return c.json({ error: 'Valid startDate and endDate are required' }, 400)
  }

  const bindings = [userId, startDate, endDate]
  const where = 'userId = ?1 AND date >= ?2 AND date <= ?3'
  const [summary, daily, categories, recent] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS count, ` +
      `SUM(CASE WHEN type = 'income' THEN 1 ELSE 0 END) AS incomeCount, ` +
      `SUM(CASE WHEN type = 'expense' THEN 1 ELSE 0 END) AS expenseCount, ` +
      `SUM(CASE WHEN category = 'Needs review' THEN 1 ELSE 0 END) AS needsReviewCount, ` +
      `COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income, ` +
      `COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense, ` +
      `COALESCE(SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END), 0) AS investment ` +
      `FROM transactions WHERE ${where}`
    ).bind(...bindings).first<Record<string, number>>(),
    c.env.DB.prepare(
      `SELECT date, ` +
      `COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income, ` +
      `COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses, ` +
      `COALESCE(SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END), 0) AS investments ` +
      `FROM transactions WHERE ${where} GROUP BY date ORDER BY date`
    ).bind(...bindings).all<Record<string, unknown>>(),
    c.env.DB.prepare(
      `SELECT category, SUM(amount) AS amount FROM transactions WHERE ${where} AND type = 'expense' GROUP BY category ORDER BY amount DESC`
    ).bind(...bindings).all<Record<string, unknown>>(),
    c.env.DB.prepare(
      `SELECT * FROM transactions WHERE ${where} ORDER BY date DESC, createdAt DESC, id DESC LIMIT 5`
    ).bind(...bindings).all<Record<string, unknown>>(),
  ])

  return c.json({
    summary: {
      count: Number(summary?.count ?? 0), incomeCount: Number(summary?.incomeCount ?? 0), expenseCount: Number(summary?.expenseCount ?? 0),
      needsReviewCount: Number(summary?.needsReviewCount ?? 0), income: Number(summary?.income ?? 0), expense: Number(summary?.expense ?? 0), investment: Number(summary?.investment ?? 0),
    },
    daily: daily.results ?? [],
    categories: categories.results ?? [],
    recent: (recent.results ?? []).map(serializeTransaction),
  })
})
