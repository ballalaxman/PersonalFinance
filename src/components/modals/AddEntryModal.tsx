import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import { Checkbox } from '@/components/ui/Checkbox'
import { transactionSchema, type TransactionFormValues } from '@/schemas/transaction'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import { today } from '@/utils/dates'
import { normalizeTags } from '@/utils/fingerprint'

interface AddEntryModalProps {
  open: boolean
  onClose: () => void
}

export function AddEntryModal({ open, onClose }: AddEntryModalProps) {
  const { state, addTransaction } = useAppStore()
  const [tagInput, setTagInput] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      date: today(),
      tags: [],
      receipt: false,
      source: 'manual',
    },
  })

  const watchTags = watch('tags') ?? []
  const watchReceipt = watch('receipt')

  const handleClose = () => {
    reset()
    setTagInput('')
    setReceiptFile(null)
    onClose()
  }

  const onSubmit = async (data: TransactionFormValues) => {
    try {
      const { transaction } = await transactionsService.create({
        ...data,
        receiptFile: receiptFile ?? undefined,
      })
      addTransaction(transaction)
      window.dispatchEvent(new Event('fintrack:transactions-changed'))
      toast.success('Transaction added')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add transaction')
    }
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag) return
    const current = watchTags
    if (!current.includes(tag)) {
      setValue('tags', normalizeTags([...current, tag]))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setValue(
      'tags',
      watchTags.filter((t) => t !== tag)
    )
  }

  const categories = state?.settings.categories ?? []
  const accounts = state?.settings.accounts ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Type selector */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div className="flex rounded-lg border border-input overflow-hidden" role="group" aria-label="Transaction type">
                  {(['expense', 'income', 'investment'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => field.onChange(t)}
                      className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                        field.value === t
                          ? t === 'expense'
                            ? 'bg-red-50 text-red-700 border-b-2 border-red-500'
                            : t === 'investment'
                              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                              : 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                      aria-pressed={field.value === t}
                    >
                      {t === 'investment' ? 'Savings / Investment' : t}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="space-y-3">
            {/* Amount */}
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />

            {/* Merchant */}
            <Input
              label="Merchant / source"
              placeholder="e.g. Whole Foods, Salary"
              error={errors.merchant?.message}
              {...register('merchant')}
            />

            {/* Date */}
            <Input
              label="Date"
              type="date"
              error={errors.date?.message}
              {...register('date')}
            />

            {/* Category */}
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
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {/* Account */}
            <Controller
              name="account"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger label="Account" error={errors.account?.message}>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {/* Tags */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {watchTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-violet-900"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag..."
                  className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  Add
                </Button>
              </div>
            </div>

            {/* Receipt */}
            <div className="flex items-center gap-2">
              <Controller
                name="receipt"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="receipt"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <label htmlFor="receipt" className="text-sm font-medium cursor-pointer">
                I have a receipt to attach
              </label>
            </div>

            {watchReceipt && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Receipt file
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                  aria-label="Upload receipt file"
                />
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
