import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/appStore'
import { today } from '@/utils/dates'
import { nanoid } from '@/utils/nanoid'
import type { RecurringPayment, RecurringCadence } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Must be positive'),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']),
  nextDate: z.string().min(1, 'Next date is required'),
  account: z.string().optional(),
  active: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

interface RecurringFormModalProps {
  open: boolean
  initial: RecurringPayment | null
  onClose: () => void
  onSave: (entry: RecurringPayment) => void
}

const CADENCE_OPTIONS: { value: RecurringCadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

export function RecurringFormModal({ open, initial, onClose, onSave }: RecurringFormModalProps) {
  const { state } = useAppStore()
  const categories = state?.settings.categories ?? []
  const accounts = state?.settings.accounts ?? []

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { ...initial }
      : { active: true, nextDate: today(), cadence: 'monthly' },
  })

  React.useEffect(() => {
    if (open) {
      reset(initial ? { ...initial } : { active: true, nextDate: today(), cadence: 'monthly' })
    }
  }, [open, initial, reset])

  const onSubmit = (data: FormValues) => {
    onSave({
      id: initial?.id ?? nanoid(),
      ...data,
    } as RecurringPayment)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit recurring' : 'Add recurring payment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" placeholder="e.g. Rent, Car loan" error={errors.name?.message} {...register('name')} />
          <Input
            label="Amount"
            type="number"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount', { valueAsNumber: true })}
          />
          <Controller
            name="cadence"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger label="Cadence" error={errors.cadence?.message}>
                  <SelectValue placeholder="Select cadence" />
                </SelectTrigger>
                <SelectContent>
                  {CADENCE_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger label="Category" error={errors.category?.message}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Input label="Next date" type="date" error={errors.nextDate?.message} {...register('nextDate')} />
          <Controller
            name="account"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <SelectTrigger label="Account (optional)">
                  <SelectValue placeholder="Any account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <div className="flex items-center gap-3">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} id="active-switch" />
              )}
            />
            <label htmlFor="active-switch" className="text-sm font-medium cursor-pointer">Active</label>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{initial ? 'Save changes' : 'Add payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
