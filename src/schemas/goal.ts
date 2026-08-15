import { z } from 'zod'

export const goalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  targetAmount: z
    .number({ invalid_type_error: 'Target must be a number' })
    .positive('Target must be positive'),
  currentSavedAmount: z
    .number({ invalid_type_error: 'Current amount must be a number' })
    .min(0, 'Cannot be negative')
    .default(0),
  dueDate: z.string().optional(),
  note: z.string().max(500).optional(),
})

export type GoalFormValues = z.infer<typeof goalSchema>
