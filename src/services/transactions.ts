import { api } from './api'
import type { Transaction, TransactionType } from '@/types'

export interface CreateTransactionInput {
  date: string
  merchant: string
  category: string
  amount: number
  type: TransactionType
  account: string
  tags: string[]
  receipt: boolean
  source?: string
  receiptFile?: File
}

export interface UpdateTransactionInput {
  date?: string
  merchant?: string
  category?: string
  amount?: number
  type?: TransactionType
  account?: string
  tags?: string[]
  receipt?: boolean
}

export interface TransactionListQuery {
  cursor?: string
  limit?: number
  startDate?: string
  endDate?: string
  search?: string
  account?: string
  category?: string
  type?: TransactionType
}

export interface TransactionTotals { count: number; income: number; expense: number; investment: number }

export const transactionsService = {
  async list(query: TransactionListQuery = {}): Promise<{ transactions: Transaction[]; nextCursor: string | null; hasMore: boolean; totals: TransactionTotals }> {
    const params = new URLSearchParams({ limit: String(query.limit ?? 50) })
    Object.entries(query).forEach(([key, value]) => value !== undefined && key !== 'limit' && params.set(key, String(value)))
    return api.get(`/api/transactions?${params.toString()}`)
  },
  async create(input: CreateTransactionInput): Promise<{ transaction: Transaction }> {
    // If there's a receipt file, upload via multipart
    if (input.receiptFile) {
      const fd = new FormData()
      fd.append('transaction', JSON.stringify({ ...input, receiptFile: undefined }))
      fd.append('receipt', input.receiptFile)
      return api.upload('/api/transactions', fd)
    }
    return api.post('/api/transactions', input)
  },

  async update(id: string, input: UpdateTransactionInput): Promise<{ transaction: Transaction }> {
    return api.patch(`/api/transactions/${id}`, input)
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/transactions/${id}`)
  },

}
