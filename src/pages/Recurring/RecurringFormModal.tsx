import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useAppStore } from '@/store/appStore'
import { today } from '@/utils/dates'
import type { RecurringSchedule } from '@/types'
import type { RecurringScheduleInput } from '@/services/recurring'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  transactionType: z.enum(['expense', 'income', 'investment']),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be positive'),
  account: z.string().optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']),
  startDate: z.string().min(1, 'Start date is required'),
  // An emptied number input yields NaN; treat it as "not set" so hidden fields can't block submit
  dayOfMonth: z.preprocess((v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v), z.number().int().min(1).max(31).optional()),
  nextDueDate: z.string().min(1, 'Next due date is required'),
  endDate: z.string().optional(),
  notifyDaysBefore: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]),
  active: z.boolean(),
}).refine((v) => v.cadence !== 'monthly' || v.dayOfMonth !== undefined, {
  path: ['dayOfMonth'], message: 'Select a monthly day',
})

type Values = z.infer<typeof schema>

export function RecurringFormModal({ open, initial, onClose, onSave }: {
  open: boolean
  initial: RecurringSchedule | null
  onClose: () => void
  onSave: (entry: RecurringScheduleInput) => Promise<void>
}) {
  const state = useAppStore((s) => s.state)
  const categories = state?.settings.categories ?? []
  const accounts = state?.settings.accounts ?? []
  // The API returns NULL for unset optional columns; the form works with '' / undefined.
  const defaults = React.useMemo<Values>(() => initial ? {
    name: initial.name, transactionType: initial.transactionType, category: initial.category,
    amount: initial.amount, account: initial.account ?? '', cadence: initial.cadence,
    startDate: initial.startDate, dayOfMonth: initial.dayOfMonth ?? undefined, nextDueDate: initial.nextDueDate,
    endDate: initial.endDate ?? '', notifyDaysBefore: initial.notifyDaysBefore, active: initial.active,
  } : {
    name: '', transactionType: 'expense', category: '', amount: 0, account: '', cadence: 'monthly',
    startDate: today(), dayOfMonth: new Date().getDate(), nextDueDate: today(), endDate: '',
    notifyDaysBefore: 0, active: true,
  }, [initial])
  const { register, control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  React.useEffect(() => { if (open) reset(defaults) }, [open, defaults, reset])
  const cadence = watch('cadence')

  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{initial ? 'Edit schedule' : 'Add recurring schedule'}</DialogTitle></DialogHeader>
      {/* Cleared optional fields are sent as null so an edit can remove a stored value */}
      <form className="space-y-4" onSubmit={handleSubmit(async (v) => onSave({ ...v, account: v.account || null, endDate: v.endDate || null, dayOfMonth: v.cadence === 'monthly' ? v.dayOfMonth : undefined }))}>
        <Controller name="transactionType" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="investment">Savings / Investment</SelectItem></SelectContent></Select>} />
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Input label="Amount" type="number" step="0.01" error={errors.amount?.message} {...register('amount', { valueAsNumber: true })} />
        <Controller name="category" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Category" error={errors.category?.message}><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>} />
        <Controller name="account" control={control} render={({ field }) => <Select value={field.value || ''} onValueChange={field.onChange}><SelectTrigger label="Account"><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>} />
        <Controller name="cadence" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Cadence"><SelectValue /></SelectTrigger><SelectContent>{['weekly','biweekly','monthly','quarterly','annual'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>} />
        <div className="grid gap-3 sm:grid-cols-2"><Input label="Start date" type="date" error={errors.startDate?.message} {...register('startDate')} /><Input label="Next due date" type="date" error={errors.nextDueDate?.message} {...register('nextDueDate')} /></div>
        {cadence === 'monthly' && <Input label="Day of month" type="number" min="1" max="31" error={errors.dayOfMonth?.message} {...register('dayOfMonth', { valueAsNumber: true })} />}
        <Input label="End date (optional)" type="date" {...register('endDate')} />
        <Controller name="notifyDaysBefore" control={control} render={({ field }) => <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}><SelectTrigger label="Reminder"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">On due date</SelectItem><SelectItem value="1">1 day before</SelectItem><SelectItem value="3">3 days before</SelectItem><SelectItem value="7">7 days before</SelectItem></SelectContent></Select>} />
        <div className="flex items-center gap-3"><Controller name="active" control={control} render={({ field }) => <Switch id="schedule-active" checked={field.value} onCheckedChange={field.onChange} />} /><label htmlFor="schedule-active" className="text-sm font-medium">Active</label></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save schedule</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
