import { z } from 'zod'

export const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  merchant: z.string().min(1, 'Merchant is required').max(200),
  category: z.string().min(1, 'Category is required'),
  amount: z.number({ invalid_type_error: 'Amount must be a number' }).positive('Amount must be positive'),
  type: z.enum(['expense', 'income']),
  account: z.string().min(1, 'Account is required'),
  tags: z.array(z.string()).default([]),
  receipt: z.boolean().default(false),
  source: z.enum(['manual', 'csv', 'document', 'google-drive']).default('manual'),
})

export type TransactionFormValues = z.infer<typeof transactionSchema>

export const updateTransactionSchema = z.object({
  category: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
})
