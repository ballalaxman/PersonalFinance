import { api } from './api'
import type { Habit, HabitLog } from '@/types'

export type HabitInput = Pick<Habit, 'name' | 'description' | 'color' | 'frequency' | 'targetPerWeek'> & Partial<Pick<Habit, 'archived' | 'sortOrder'>>

export const habitsService = {
  list: () => api.get<{ habits: Habit[]; logs: HabitLog[] }>('/api/habits'),
  create: (input: HabitInput) => api.post<{ habit: Habit }>('/api/habits', input),
  update: (id: string, input: Partial<HabitInput>) => api.patch<{ habit: Habit }>(`/api/habits/${encodeURIComponent(id)}`, input),
  remove: (id: string) => api.delete<{ success: boolean }>(`/api/habits/${encodeURIComponent(id)}`),
  check: (id: string, date: string) => api.put<{ success: boolean }>(`/api/habits/${encodeURIComponent(id)}/logs/${date}`, {}),
  uncheck: (id: string, date: string) => api.delete<{ success: boolean }>(`/api/habits/${encodeURIComponent(id)}/logs/${date}`),
}
