import type { Env } from './index'
import { getSettings } from './utils/settings'
import { localDateForTimezone } from './utils/recurrence'
import { sendPush, type PushSubscriptionKeys, type VapidKeys } from './utils/webpush'
import {
  isInNoticeWindow, localHour, pendingHabits, planBillReminder, planHabitReminder,
  type DueBill, type HabitForReminder, type PushMessage, type UpcomingBill,
} from './utils/reminderPlan'

export function vapidKeysFromEnv(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || env.APP_ORIGIN || 'mailto:admin@localhost',
  }
}

interface SubscriptionRow extends PushSubscriptionKeys { id: string }

export interface DeliveryResult { sent: number; failed: number; removed: number }

/** Send one message to every device the user enabled; prune expired subscriptions. */
export async function deliverToUser(env: Env, keys: VapidKeys, userId: string, message: PushMessage): Promise<DeliveryResult> {
  const subs = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE userId = ?1')
    .bind(userId).all<SubscriptionRow>()
  const result: DeliveryResult = { sent: 0, failed: 0, removed: 0 }

  for (const sub of subs.results ?? []) {
    try {
      const res = await sendPush(sub, message, keys, { topic: message.tag, urgency: 'normal' })
      if (res.ok) {
        result.sent++
      } else if (res.gone) {
        result.removed++
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?1').bind(sub.id).run()
      } else {
        result.failed++
        await env.DB.prepare('UPDATE push_subscriptions SET lastFailure = ?1, updatedAt = ?2 WHERE id = ?3')
          .bind(`${res.status} ${res.error}`.slice(0, 300), new Date().toISOString(), sub.id).run()
      }
    } catch (err) {
      result.failed++
      console.error('[reminders] push failed', err instanceof Error ? err.message : err)
    }
  }
  return result
}

async function alreadySent(env: Env, kind: string, refId: string, forDate: string): Promise<boolean> {
  return Boolean(await env.DB.prepare('SELECT 1 FROM reminder_log WHERE kind = ?1 AND refId = ?2 AND forDate = ?3')
    .bind(kind, refId, forDate).first())
}

function markSent(env: Env, userId: string, items: { kind: string; refId: string; forDate: string }[], ts: string) {
  if (!items.length) return Promise.resolve()
  return env.DB.batch(items.map((i) => env.DB.prepare(
    'INSERT OR IGNORE INTO reminder_log (userId, kind, refId, forDate, sentAt) VALUES (?1, ?2, ?3, ?4, ?5)'
  ).bind(userId, i.kind, i.refId, i.forDate, ts)))
}

function hourSetting(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback
}

async function billReminder(env: Env, userId: string, today: string) {
  const [schedules, occurrences] = await Promise.all([
    env.DB.prepare(
      'SELECT id, name, nextDueDate, notifyDaysBefore FROM recurring_schedules ' +
      'WHERE userId = ?1 AND active = 1 AND notifyDaysBefore > 0 AND nextDueDate > ?2 AND (endDate IS NULL OR nextDueDate <= endDate)'
    ).bind(userId, today).all<{ id: string; name: string; nextDueDate: string; notifyDaysBefore: number }>(),
    env.DB.prepare(
      "SELECT o.id, s.name, CASE WHEN o.status = 'postponed' THEN o.postponedUntil ELSE o.dueDate END AS remindOn " +
      'FROM recurring_occurrences o JOIN recurring_schedules s ON s.id = o.scheduleId ' +
      "WHERE o.userId = ?1 AND ((o.status = 'pending' AND o.dueDate <= ?2) OR (o.status = 'postponed' AND o.postponedUntil <= ?2)) LIMIT 50"
    ).bind(userId, today).all<{ id: string; name: string; remindOn: string }>(),
  ])

  const upcoming: UpcomingBill[] = []
  const due: DueBill[] = []
  const log: { kind: string; refId: string; forDate: string }[] = []
  for (const s of schedules.results ?? []) {
    if (!isInNoticeWindow(s.nextDueDate, s.notifyDaysBefore, today)) continue
    if (await alreadySent(env, 'upcoming', s.id, s.nextDueDate)) continue
    upcoming.push({ id: s.id, name: s.name, dueDate: s.nextDueDate })
    log.push({ kind: 'upcoming', refId: s.id, forDate: s.nextDueDate })
  }
  for (const o of occurrences.results ?? []) {
    if (await alreadySent(env, 'due', o.id, o.remindOn)) continue
    due.push({ id: o.id, name: o.name, dueDate: o.remindOn })
    log.push({ kind: 'due', refId: o.id, forDate: o.remindOn })
  }
  return { message: planBillReminder(upcoming, due, today), log }
}

async function habitReminder(env: Env, userId: string, today: string) {
  if (await alreadySent(env, 'habits', userId, today)) return { message: null, log: [] }
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
  const [habits, logs] = await Promise.all([
    env.DB.prepare('SELECT id, name, frequency, targetPerWeek FROM habits WHERE userId = ?1 AND archived = 0 ORDER BY sortOrder, createdAt')
      .bind(userId).all<HabitForReminder>(),
    env.DB.prepare('SELECT habitId, date FROM habit_logs WHERE userId = ?1 AND date >= ?2 AND date <= ?3')
      .bind(userId, weekAgo, today).all<{ habitId: string; date: string }>(),
  ])
  const done = new Map<string, Set<string>>()
  for (const l of logs.results ?? []) {
    if (!done.has(l.habitId)) done.set(l.habitId, new Set())
    done.get(l.habitId)!.add(l.date)
  }
  const message = planHabitReminder(pendingHabits(habits.results ?? [], done, today), today)
  return { message, log: message ? [{ kind: 'habits', refId: userId, forDate: today }] : [] }
}

/**
 * Cron entry point (every 15 minutes). For each user with a registered
 * device, sends at most one bill reminder batch and one habit nudge per
 * local day, at or after the hours chosen in Settings.
 */
export async function processReminders(env: Env, at = new Date()): Promise<{ users: number; sent: number }> {
  const keys = vapidKeysFromEnv(env)
  if (!keys) return { users: 0, sent: 0 }

  const users = await env.DB.prepare('SELECT DISTINCT userId FROM push_subscriptions LIMIT 1000').all<{ userId: string }>()
  let sent = 0
  for (const { userId } of users.results ?? []) {
    try {
      const settings = await getSettings(env.DB, userId)
      const timezone = typeof settings.timezone === 'string' ? settings.timezone : 'UTC'
      const today = localDateForTimezone(at, timezone)
      const hour = localHour(at, timezone)
      const billHour = hourSetting(settings.reminderHour, 9)
      const habitHour = hourSetting(settings.habitReminderHour, 20)

      const plans = []
      if (billHour !== null && hour >= billHour) plans.push(await billReminder(env, userId, today))
      if (habitHour !== null && hour >= habitHour) plans.push(await habitReminder(env, userId, today))

      for (const plan of plans) {
        if (!plan.message) continue
        const result = await deliverToUser(env, keys, userId, plan.message)
        // Record once delivered, or once no devices remain; transient failures retry on the next run.
        if (result.sent > 0 || result.failed === 0) await markSent(env, userId, plan.log, at.toISOString())
        sent += result.sent
      }
    } catch (err) {
      console.error('[reminders] user failed', err instanceof Error ? err.message : err)
    }
  }

  // Keep the log small; entries only matter for the current reminder window.
  await env.DB.prepare('DELETE FROM reminder_log WHERE sentAt < ?1')
    .bind(new Date(at.getTime() - 60 * 86_400_000).toISOString()).run()

  return { users: (users.results ?? []).length, sent }
}
