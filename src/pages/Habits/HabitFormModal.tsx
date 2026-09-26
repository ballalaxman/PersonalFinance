import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useHabitStore } from '@/store/habitStore'
import { cn } from '@/utils/cn'
import type { Habit, HabitColor } from '@/types'
import { HABIT_COLORS } from './habitColors'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(200),
  frequency: z.enum(['daily', 'weekly']),
  targetPerWeek: z.number().int().min(1).max(7),
  color: z.enum(['violet', 'emerald', 'sky', 'amber', 'rose', 'slate']),
})

type Values = z.infer<typeof schema>

export function HabitFormModal({ open, initial, onClose }: { open: boolean; initial: Habit | null; onClose: () => void }) {
  const { create, update } = useHabitStore()
  const defaults = React.useMemo<Values>(() => initial
    ? { name: initial.name, description: initial.description, frequency: initial.frequency, targetPerWeek: initial.frequency === 'daily' ? 3 : initial.targetPerWeek, color: initial.color }
    : { name: '', description: '', frequency: 'daily', targetPerWeek: 3, color: 'violet' }, [initial])
  const { register, control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  React.useEffect(() => { if (open) reset(defaults) }, [open, defaults, reset])
  const frequency = watch('frequency')

  const onSubmit = async (values: Values) => {
    const input = { ...values, targetPerWeek: values.frequency === 'daily' ? 7 : values.targetPerWeek }
    try {
      if (initial) await update(initial.id, input)
      else await create(input)
      toast.success(initial ? 'Habit updated' : 'Habit created')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save habit')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{initial ? 'Edit habit' : 'New habit'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input id="habit-name" label="Name" placeholder="e.g. Read 20 pages" error={errors.name?.message} {...register('name')} />
          <Input id="habit-description" label="Note (optional)" placeholder="Why it matters, or how you'll do it" error={errors.description?.message} {...register('description')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller name="frequency" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger label="How often"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Some days each week</SelectItem>
                </SelectContent>
              </Select>
            )} />
            {frequency === 'weekly' && (
              <Controller name="targetPerWeek" control={control} render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger label="Days per week"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'day' : 'days'}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            )}
          </div>
          <Controller name="color" control={control} render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-foreground">Colour</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(HABIT_COLORS) as HabitColor[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => field.onChange(key)}
                    aria-pressed={field.value === key}
                    aria-label={HABIT_COLORS[key].label}
                    className={cn(
                      'h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600',
                      HABIT_COLORS[key].dot,
                      field.value === key && 'ring-2 ring-foreground'
                    )}
                  />
                ))}
              </div>
            </fieldset>
          )} />
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{initial ? 'Save' : 'Create habit'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
