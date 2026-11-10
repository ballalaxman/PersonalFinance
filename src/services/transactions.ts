import { api, ApiError } from './api'
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
  /** Save even though a look-alike exists (the user was asked and said yes). */
  allowDuplicate?: boolean
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
  allowDuplicate?: boolean
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
  /**
   * Saves the transaction first, then attaches the receipt file to it. If the
   * upload fails the transaction is kept and `receiptError` says why, so no
   * stray file is ever left in Documents.
   */
  async create(input: CreateTransactionInput): Promise<{ transaction: Transaction; receiptDocument?: Document; receiptError?: string }> {
    const { receiptFile, ...transaction } = input
    if (!receiptFile) return api.post('/api/transactions', transaction)

    // The server marks the transaction as having a receipt once the file is linked.
    const result = await api.post<{ transaction: Transaction }>('/api/transactions', { ...transaction, receipt: false })
    try {
      const { documents } = await documentsService.upload([receiptFile], result.transaction.id)
      const receiptDocument = documents[0]
      return { transaction: { ...result.transaction, receipt: true, receiptDocumentId: receiptDocument.id }, receiptDocument }
    } catch (err) {
      const reasons = err instanceof ApiError && Array.isArray(err.body.errors) ? err.body.errors : []
      return { ...result, receiptError: typeof reasons[0] === 'string' ? reasons[0] : err instanceof Error ? err.message : 'Upload failed' }
    }
  },

  async update(id: string, input: UpdateTransactionInput): Promise<{ transaction: Transaction }> {
    return api.patch(`/api/transactions/${id}`, input)
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/transactions/${id}`)
  },

}
