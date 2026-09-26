import { api } from './api'
import { documentsService } from './documents'
import type { Document, Transaction, TransactionType } from '@/types'

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
  async create(input: CreateTransactionInput): Promise<{ transaction: Transaction; receiptDocument?: Document }> {
    const { receiptFile, ...transaction } = input
    // The transactions endpoint only accepts JSON, so store the receipt in the
    // document vault first and then record the transaction.
    if (receiptFile) {
      const { documents, errors } = await documentsService.upload([receiptFile])
      if (!documents.length) throw new Error(errors[0] ?? 'Receipt upload failed')
      const result = await api.post<{ transaction: Transaction }>('/api/transactions', { ...transaction, receipt: true })
      return { ...result, receiptDocument: documents[0] }
    }
    return api.post('/api/transactions', transaction)
  },

  async update(id: string, input: UpdateTransactionInput): Promise<{ transaction: Transaction }> {
    return api.patch(`/api/transactions/${id}`, input)
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/transactions/${id}`)
  },

}
