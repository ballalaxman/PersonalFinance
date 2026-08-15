import { api } from './api'
import type { Transaction, ImportResult } from '@/types'

export interface CreateTransactionInput {
  date: string
  merchant: string
  category: string
  amount: number
  type: 'expense' | 'income'
  account: string
  tags: string[]
  receipt: boolean
  source?: string
  receiptFile?: File
}

export interface UpdateTransactionInput {
  category?: string
  tags?: string[]
}

export const transactionsService = {
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

  async importBatch(
    transactions: CreateTransactionInput[]
  ): Promise<ImportResult & { transactions: Transaction[] }> {
    return api.post('/api/transactions/batch', { transactions })
  },
}
