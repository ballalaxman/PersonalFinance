import type { D1Database } from '@cloudflare/workers-types'

interface LegacyRecurring {
  id?: string
  name?: string
  category?: string
  amount?: number
  cadence?: string
  nextDate?: string
  account?: string
  active?: boolean
}

export async function migrateLegacyRecurringSettings(db: D1Database, userId: string): Promise<void> {
  const marker = await db.prepare("SELECT value FROM settings WHERE userId=?1 AND key='recurringMigrationVersion'")
    .bind(userId).first<{ value: string }>()
  if (marker) return

  const rows = await db.prepare("SELECT key,value FROM settings WHERE userId=?1 AND key IN ('recurring','subscriptions')")
    .bind(userId).all<{ key: string; value: string }>()
  const statements = []
  const seen = new Set<string>()
  const ts = new Date().toISOString()

  for (const row of rows.results ?? []) {
    let entries: LegacyRecurring[] = []
    try { entries = JSON.parse(row.value) } catch { continue }
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (!entry.name || !entry.amount || !entry.nextDate || !entry.cadence) continue
      const key = `${entry.name.trim().toLowerCase()}|${entry.amount}|${entry.cadence}|${entry.nextDate}`
      if (seen.has(key)) continue
      seen.add(key)
      const id = `legacy-${userId}-${entry.id ?? encodeURIComponent(key).slice(0, 80)}`
      const day = Number(entry.nextDate.slice(8, 10)) || null
      statements.push(db.prepare(
        'INSERT OR IGNORE INTO recurring_schedules (id,userId,name,transactionType,category,amount,account,cadence,startDate,dayOfMonth,nextDueDate,active,notifyDaysBefore,createdAt,updatedAt) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,0,?13,?14)'
      ).bind(id, userId, entry.name, 'expense', entry.category ?? 'Needs review', entry.amount,
        entry.account ?? null, entry.cadence, entry.nextDate, entry.cadence === 'monthly' ? day : null,
        entry.nextDate, entry.active === false ? 0 : 1, ts, ts))
    }
  }

  statements.push(db.prepare(
    "INSERT INTO settings (userId,key,value,updatedAt) VALUES (?1,'recurringMigrationVersion','1',?2) ON CONFLICT(userId,key) DO UPDATE SET value='1',updatedAt=excluded.updatedAt"
  ).bind(userId, ts))
  await db.batch(statements)
}
