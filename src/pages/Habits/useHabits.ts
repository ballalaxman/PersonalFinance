import { useEffect, useMemo } from 'react'
import { habitCreatedDate, useHabitStore } from '@/store/habitStore'
import { habitStats, type HabitStats } from '@/utils/habits'
import { today as localToday } from '@/utils/dates'
import type { Habit } from '@/types'

export interface HabitWithStats {
  habit: Habit
  createdDate: string
  done: Set<string>
  stats: HabitStats
}

/** Loads habits once per session and derives per-habit stats for today. */
export function useHabits() {
  const { habits, done, loaded, isLoading, error, load } = useHabitStore()
  const today = localToday()

  useEffect(() => {
    if (!loaded && !isLoading && !error) void load()
  }, [loaded, isLoading, error, load])

  const items = useMemo<HabitWithStats[]>(() => habits.map((habit) => {
    const set = done[habit.id] ?? new Set<string>()
    // Check-ins can be backfilled to before the habit was created; stats start at whichever is earlier.
    let createdDate = habitCreatedDate(habit)
    for (const day of set) if (day < createdDate) createdDate = day
    return { habit, createdDate, done: set, stats: habitStats(habit, createdDate, set, today) }
  }), [habits, done, today])

  return { items, today, loaded, isLoading, error, reload: load }
}
