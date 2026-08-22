import { api } from './api'
import type { RecurringOccurrence, RecurringSchedule } from '@/types'

export type RecurringScheduleInput = Omit<RecurringSchedule, 'id' | 'createdAt' | 'updatedAt'>

export const recurringService = {
  list: () => api.get<{ schedules: RecurringSchedule[]; occurrences: RecurringOccurrence[] }>('/api/recurring'),
  create: (input: RecurringScheduleInput) => api.post<{ schedule: RecurringSchedule }>('/api/recurring', input),
  update: (id: string, input: RecurringScheduleInput) => api.patch<{ schedule: RecurringSchedule }>(`/api/recurring/${id}`, input),
  remove: (id: string) => api.delete<{ success: boolean }>(`/api/recurring/${id}`),
  confirm: (id: string, input: Record<string, unknown> = {}) => api.post<{ success: boolean; transactionId: string }>(`/api/recurring/occurrences/${id}/confirm`, input),
  skip: (id: string) => api.post<{ success: boolean }>(`/api/recurring/occurrences/${id}/skip`, {}),
  postpone: (id: string, postponedUntil: string) => api.post<{ success: boolean }>(`/api/recurring/occurrences/${id}/postpone`, { postponedUntil }),
}
