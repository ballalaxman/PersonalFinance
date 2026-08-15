import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { budgetSchema, type BudgetFormValues } from '@/schemas/budget'
import { useAppStore } from '@/store/appStore'
import { nanoid } from '@/utils/nanoid'
import type { Budget } from '@/types'

interface Props {
  open: boolean
  initial: Budget | null
  onClose: () => void
  onSave: (b: Budget) => void
}

export function BudgetFormModal({ open, initial, onClose, onSave }: Props) {
  const { state } = useAppStore()
  const categories = state?.settings.categories ?? []

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: initial ?? { active: true },
  })

  React.useEffect(() => {
    if (open) reset(initial ?? { active: true })
  }, [open, initial, reset])

  const onSubmit = (data: BudgetFormValues) => {
    onSave({ id: initial?.id ?? nanoid(), ...data })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit budget' : 'Create budget'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller name="category" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger label="Category" error={errors.category?.message}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          <Input label="Monthly limit" type="number" step="0.01" error={errors.monthlyLimit?.message} {...register('monthlyLimit', { valueAsNumber: true })} />
          <div className="flex items-center gap-3">
            <Controller name="active" control={control} render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} id="budget-active" />
            )} />
            <label htmlFor="budget-active" className="text-sm font-medium cursor-pointer">Active</label>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{initial ? 'Save' : 'Create budget'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
