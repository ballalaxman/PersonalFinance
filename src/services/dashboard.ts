import { api } from './api'
import { useAuthStore } from '@/store/authStore'
import type { Transaction } from '@/types'

export interface DashboardData {
  summary: { count: number; incomeCount: number; expenseCount: number; needsReviewCount: number; income: number; expense: number; investment: number }
  daily: { date: string; income: number; expenses: number; investments: number }[]
  categories: { category: string; amount: number }[]
  recent: Transaction[]
}

// Last response per date range, so returning to a page shows real figures
// immediately (then refreshes) instead of flashing zeros while it loads.
const cache = new Map<string, DashboardData>()
const key = (startDate: string, endDate: string) => `${startDate}|${endDate}`

useAuthStore.subscribe((next, prev) => {
  if (next.user?.id !== prev.user?.id || (!next.token && prev.token)) cache.clear()
})

export const dashboardService = {
  cached(startDate: string, endDate: string): DashboardData | undefined {
    return cache.get(key(startDate, endDate))
  },

  async get(startDate: string, endDate: string): Promise<DashboardData> {
    const data = await api.get<DashboardData>(`/api/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
    cache.set(key(startDate, endDate), data)
    return data
  },
}
