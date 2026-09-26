import { create } from 'zustand'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { habitsService, type HabitInput } from '@/services/habits'
import { useAuthStore } from '@/store/authStore'
import type { Habit } from '@/types'

interface HabitStore {
  habits: Habit[]
  /** habitId → set of completed YYYY-MM-DD dates */
  done: Record<string, Set<string>>
  loaded: boolean
  isLoading: boolean
  error: string | null
  load: () => Promise<void>
  toggle: (habitId: string, date: string) => Promise<void>
  create: (input: HabitInput) => Promise<Habit>
  update: (id: string, input: Partial<HabitInput>) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** Local calendar day the habit was created, used to scope stats. */
export function habitCreatedDate(habit: Habit): string {
  return format(new Date(habit.createdAt), 'yyyy-MM-dd')
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  done: {},
  loaded: false,
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null })
    try {
      const { habits, logs } = await habitsService.list()
      const done: Record<string, Set<string>> = {}
      for (const log of logs) (done[log.habitId] ??= new Set()).add(log.date)
      set({ habits, done, loaded: true, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load habits', isLoading: false })
    }
  },

  // Optimistic: flip locally, roll back if the server rejects it
  toggle: async (habitId, date) => {
    const current = get().done[habitId] ?? new Set<string>()
    const wasDone = current.has(date)
    const apply = (makeDone: boolean) => {
      const next = new Set(get().done[habitId] ?? [])
      if (makeDone) next.add(date)
      else next.delete(date)
      set({ done: { ...get().done, [habitId]: next } })
    }
    apply(!wasDone)
    try {
      if (wasDone) await habitsService.uncheck(habitId, date)
      else await habitsService.check(habitId, date)
    } catch (err) {
      apply(wasDone)
      toast.error(err instanceof Error ? err.message : 'Failed to update habit')
    }
  },

  create: async (input) => {
    const { habit } = await habitsService.create({ ...input, sortOrder: get().habits.length })
    set({ habits: [...get().habits, { ...habit, archived: Boolean(habit.archived) }] })
    return habit
  },

  update: async (id, input) => {
    const { habit } = await habitsService.update(id, input)
    set({ habits: get().habits.map((h) => (h.id === id ? { ...h, ...habit } : h)) })
  },

  remove: async (id) => {
    await habitsService.remove(id)
    const done = { ...get().done }
    delete done[id]
    set({ habits: get().habits.filter((h) => h.id !== id), done })
  },
}))

// Never show one account's habits to the next person who signs in on this browser.
useAuthStore.subscribe((next, prev) => {
  if (next.user?.id !== prev.user?.id || (!next.token && prev.token)) {
    useHabitStore.setState({ habits: [], done: {}, loaded: false, isLoading: false, error: null })
  }
})
