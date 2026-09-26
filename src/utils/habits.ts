import type { Habit } from '@/types'

/**
 * Habit statistics. All dates are local calendar days as YYYY-MM-DD strings;
 * arithmetic runs in UTC on those strings so DST never shifts a day.
 * Weeks start on Monday.
 */

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

/** The last `count` days ending at `end`, oldest first. */
export function lastNDays(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - count + 1))
}

function countInWeek(done: Set<string>, start: string): number {
  let n = 0
  for (let i = 0; i < 7; i++) if (done.has(addDays(start, i))) n++
  return n
}

/** Consecutive done days ending today; an unchecked today doesn't break a streak yet. */
export function currentDailyStreak(done: Set<string>, today: string): number {
  let day = done.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (done.has(day)) { streak++; day = addDays(day, -1) }
  return streak
}

export function bestDailyStreak(done: Set<string>): number {
  const days = [...done].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of days) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}

/** Consecutive weeks meeting the target, ending this week; an unfinished current week doesn't break it. */
export function currentWeeklyStreak(done: Set<string>, target: number, today: string): number {
  let week = weekStart(today)
  if (countInWeek(done, week) < target) week = addDays(week, -7)
  let streak = 0
  while (countInWeek(done, week) >= target) { streak++; week = addDays(week, -7) }
  return streak
}

export function bestWeeklyStreak(done: Set<string>, target: number): number {
  if (!done.size) return 0
  const weeks = [...new Set([...done].map(weekStart))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const week of weeks) {
    if (countInWeek(done, week) < target) { run = 0; prev = null; continue }
    run = prev && daysBetween(prev, week) === 7 ? run + 1 : 1
    best = Math.max(best, run)
    prev = week
  }
  return best
}

export interface HabitStats {
  doneToday: boolean
  weekCount: number
  /** Streak in days (daily habits) or weeks (weekly habits). */
  currentStreak: number
  bestStreak: number
  /** 0–100, over the last 30 days or since the habit was created if newer. */
  completionRate: number
  dueToday: boolean
}

export function habitStats(habit: Pick<Habit, 'frequency' | 'targetPerWeek'>, createdDate: string, done: Set<string>, today: string): HabitStats {
  const weekCount = countInWeek(done, weekStart(today))
  const doneToday = done.has(today)
  const windowStart = createdDate > addDays(today, -29) ? createdDate : addDays(today, -29)
  const windowDays = Math.max(1, daysBetween(windowStart, today) + 1)
  let doneInWindow = 0
  for (let i = 0; i < windowDays; i++) if (done.has(addDays(windowStart, i))) doneInWindow++

  if (habit.frequency === 'daily') {
    return {
      doneToday,
      weekCount,
      currentStreak: currentDailyStreak(done, today),
      bestStreak: bestDailyStreak(done),
      completionRate: Math.round((doneInWindow / windowDays) * 100),
      dueToday: true,
    }
  }

  const target = habit.targetPerWeek
  const expected = (target * windowDays) / 7
  return {
    doneToday,
    weekCount,
    currentStreak: currentWeeklyStreak(done, target, today),
    bestStreak: bestWeeklyStreak(done, target),
    completionRate: Math.round(Math.min(1, doneInWindow / expected) * 100),
    dueToday: doneToday || weekCount < target,
  }
}

/** Share of active habits checked each day, for the overview heatmap (null before any habit existed). */
export function dailyCompletion(
  habits: { id: string; createdDate: string }[],
  doneByHabit: Map<string, Set<string>>,
  days: string[]
): { date: string; ratio: number | null; done: number; total: number }[] {
  return days.map((date) => {
    const existing = habits.filter((h) => h.createdDate <= date)
    if (!existing.length) return { date, ratio: null, done: 0, total: 0 }
    const done = existing.filter((h) => doneByHabit.get(h.id)?.has(date)).length
    return { date, ratio: done / existing.length, done, total: existing.length }
  })
}
