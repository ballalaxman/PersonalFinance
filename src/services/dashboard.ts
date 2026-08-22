import { api } from './api'
import type { Transaction } from '@/types'

export interface DashboardData {
  summary: { count: number; incomeCount: number; expenseCount: number; needsReviewCount: number; income: number; expense: number; investment: number }
  daily: { date: string; income: number; expenses: number; investments: number }[]
  categories: { category: string; amount: number }[]
  recent: Transaction[]
}

export const dashboardService = {
  get(startDate: string, endDate: string): Promise<DashboardData> {
    return api.get(`/api/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`)
  },
}
