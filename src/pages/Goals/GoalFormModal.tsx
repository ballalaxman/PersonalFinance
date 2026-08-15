import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { goalSchema, type GoalFormValues } from '@/schemas/goal'
import { nanoid } from '@/utils/nanoid'
import type { Goal } from '@/types'

interface Props {
  open: boolean
  initial: Goal | null
  onClose: () => void
  onSave: (g: Goal) => void
}

export function GoalFormModal({ open, initial, onClose, onSave }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: initial ?? { currentSavedAmount: 0 },
  })

  React.useEffect(() => {
    if (open) reset(initial ?? { currentSavedAmount: 0 })
  }, [open, initial, reset])

  const onSubmit = (data: GoalFormValues) => {
    onSave({ id: initial?.id ?? nanoid(), ...data })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit goal' : 'Create goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Goal name" placeholder="e.g. Emergency fund, Vacation" error={errors.name?.message} {...register('name')} />
          <Input label="Target amount" type="number" step="0.01" error={errors.targetAmount?.message} {...register('targetAmount', { valueAsNumber: true })} />
          <Input label="Current saved amount" type="number" step="0.01" error={errors.currentSavedAmount?.message} {...register('currentSavedAmount', { valueAsNumber: true })} />
          <Input label="Due date (optional)" type="date" {...register('dueDate')} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
            <textarea
              {...register('note')}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 resize-none"
              placeholder="Optional note…"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{initial ? 'Save' : 'Create goal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
