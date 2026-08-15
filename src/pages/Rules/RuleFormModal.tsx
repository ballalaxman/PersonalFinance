import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { nanoid } from '@/utils/nanoid'
import type { Rule } from '@/types'

const schema = z.object({
  whenText: z.string().min(1, 'Condition is required'),
  thenText: z.string().min(1, 'Action is required'),
  enabled: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  initial: Rule | null
  onClose: () => void
  onSave: (r: Rule) => void
}

export function RuleFormModal({ open, initial, onClose, onSave }: Props) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { enabled: true },
  })

  React.useEffect(() => {
    if (open) reset(initial ?? { enabled: true })
  }, [open, initial, reset])

  const onSubmit = (data: FormValues) => {
    onSave({
      id: initial?.id ?? nanoid(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      ...data,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit rule' : 'Create rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="When (merchant/source contains)"
            placeholder="e.g. Netflix, Whole Foods"
            hint="Plain text match against merchant name"
            error={errors.whenText?.message}
            {...register('whenText')}
          />
          <Input
            label="Then (set category or tag)"
            placeholder="e.g. Subscriptions or tag:streaming"
            hint="Category name or 'tag:tagname'"
            error={errors.thenText?.message}
            {...register('thenText')}
          />
          <div className="flex items-center gap-3">
            <Controller name="enabled" control={control} render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} id="rule-enabled" />
            )} />
            <label htmlFor="rule-enabled" className="text-sm font-medium cursor-pointer">Enabled</label>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{initial ? 'Save' : 'Create rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
