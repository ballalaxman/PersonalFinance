import { describe, expect, it } from 'vitest'
import {
  addDays, bestDailyStreak, bestWeeklyStreak, currentDailyStreak, currentWeeklyStreak,
  dailyCompletion, habitStats, lastNDays, weekStart,
} from './habits'

const set = (...days: string[]) => new Set(days)

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-09-26')).toBe('2026-09-21') // Saturday
    expect(weekStart('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // Sunday
  })

  it('lists the last N days oldest first', () => {
    expect(lastNDays('2026-09-26', 3)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26'])
  })
})

describe('daily streaks', () => {
  it('counts back from today', () => {
    expect(currentDailyStreak(set('2026-09-24', '2026-09-25', '2026-09-26'), '2026-09-26')).toBe(3)
  })

  it('keeps yesterday\'s streak alive until today is over', () => {
    expect(currentDailyStreak(set('2026-09-24', '2026-09-25'), '2026-09-26')).toBe(2)
  })

  it('resets after a missed day', () => {
    expect(currentDailyStreak(set('2026-09-23', '2026-09-24'), '2026-09-26')).toBe(0)
  })

  it('finds the longest run in history', () => {
    expect(bestDailyStreak(set('2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10', '2026-08-11'))).toBe(3)
    expect(bestDailyStreak(set())).toBe(0)
  })
})

describe('weekly streaks', () => {
  // Weeks: 2026-09-07, 09-14, 09-21 (current, today = Sat 09-26)
  const done = set('2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-22')

  it('counts consecutive weeks meeting the target, ignoring an unfinished current week', () => {
    expect(currentWeeklyStreak(done, 3, '2026-09-26')).toBe(2)
  })

  it('includes the current week once it meets the target', () => {
    expect(currentWeeklyStreak(set(...done, '2026-09-23', '2026-09-24'), 3, '2026-09-26')).toBe(3)
  })

  it('finds the best run of qualifying weeks', () => {
    expect(bestWeeklyStreak(done, 3)).toBe(2)
    expect(bestWeeklyStreak(done, 4)).toBe(0)
  })
})

describe('habitStats', () => {
  it('rates a daily habit over the days since creation when newer than 30 days', () => {
    const stats = habitStats({ frequency: 'daily', targetPerWeek: 7 }, '2026-09-17', set('2026-09-24', '2026-09-25', '2026-09-26'), '2026-09-26')
    expect(stats).toMatchObject({ doneToday: true, currentStreak: 3, completionRate: 30, dueToday: true })
  })

  it('marks a weekly habit as not due once this week\'s target is met', () => {
    const stats = habitStats({ frequency: 'weekly', targetPerWeek: 2 }, '2026-01-01', set('2026-09-21', '2026-09-22'), '2026-09-26')
    expect(stats.weekCount).toBe(2)
    expect(stats.dueToday).toBe(false)
  })

  it('caps weekly completion at 100%', () => {
    const days = lastNDays('2026-09-26', 30)
    expect(habitStats({ frequency: 'weekly', targetPerWeek: 1 }, '2026-01-01', new Set(days), '2026-09-26').completionRate).toBe(100)
  })
})

describe('dailyCompletion', () => {
  it('only counts habits that existed on each day', () => {
    const result = dailyCompletion(
      [{ id: 'a', createdDate: '2026-09-01' }, { id: 'b', createdDate: '2026-09-25' }],
      new Map([['a', set('2026-09-24', '2026-09-25')], ['b', set('2026-09-25')]]),
      ['2026-08-31', '2026-09-24', '2026-09-25', '2026-09-26'],
    )
    expect(result.map((r) => r.ratio)).toEqual([null, 1, 1, 0])
  })
})
