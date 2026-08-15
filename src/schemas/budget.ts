import { z } from 'zod'

export const budgetSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  monthlyLimit: z
    .number({ invalid_type_error: 'Limit must be a number' })
    .positive('Limit must be positive'),
  active: z.boolean().default(true),
})

export type BudgetFormValues = z.infer<typeof budgetSchema>
