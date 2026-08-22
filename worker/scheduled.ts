import type { Env } from './index'
import { newId, now } from './utils/id'
import { localDateForTimezone, nextRecurringDate, type Cadence } from './utils/recurrence'

interface DueSchedule {
  id: string
  userId: string
  amount: number
  cadence: Cadence
  dayOfMonth: number | null
  nextDueDate: string
  endDate: string | null
  timezoneValue: string | null
}

function parseTimezone(value: string | null): string {
  if (!value) return 'UTC'
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : 'UTC'
  } catch {
    return value
  }
}

export async function processDueSchedules(env: Env, at = new Date()): Promise<{ created: number; advanced: number }> {
  const result = await env.DB.prepare(
    "SELECT s.id,s.userId,s.amount,s.cadence,s.dayOfMonth,s.nextDueDate,s.endDate,st.value AS timezoneValue " +
    "FROM recurring_schedules s LEFT JOIN settings st ON st.userId=s.userId AND st.key='timezone' " +
    'WHERE s.active=1 ORDER BY s.nextDueDate ASC LIMIT 500'
  ).all<DueSchedule>()

  let created = 0
  let advanced = 0
  for (const schedule of result.results ?? []) {
    const localToday = localDateForTimezone(at, parseTimezone(schedule.timezoneValue))
    let dueDate = schedule.nextDueDate
    let guard = 0
    while (dueDate <= localToday && (!schedule.endDate || dueDate <= schedule.endDate) && guard++ < 24) {
      const nextDueDate = nextRecurringDate(dueDate, schedule.cadence, schedule.dayOfMonth)
      const ts = now()
      const batch = await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO recurring_occurrences (id,userId,scheduleId,dueDate,expectedAmount,status,createdAt) VALUES (?1,?2,?3,?4,?5,'pending',?6) ON CONFLICT(scheduleId,dueDate) DO NOTHING"
        ).bind(newId(), schedule.userId, schedule.id, dueDate, schedule.amount, ts),
        env.DB.prepare(
          'UPDATE recurring_schedules SET nextDueDate=?1,updatedAt=?2 WHERE id=?3 AND userId=?4 AND nextDueDate=?5'
        ).bind(nextDueDate, ts, schedule.id, schedule.userId, dueDate),
      ])
      created += batch[0].meta.changes ?? 0
      const changed = batch[1].meta.changes ?? 0
      advanced += changed
      if (!changed) break
      dueDate = nextDueDate
    }
  }
  return { created, advanced }
}
