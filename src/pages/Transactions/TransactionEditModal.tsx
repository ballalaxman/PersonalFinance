import React, { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { transactionSchema, type TransactionFormValues } from '@/schemas/transaction'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import { normalizeTags } from '@/utils/fingerprint'
import type { Transaction } from '@/types'

interface Props { transaction: Transaction | null; onClose: () => void; onSaved?: () => void }

export function TransactionEditModal({ transaction, onClose, onSaved }: Props) {
  const { state, updateTransaction } = useAppStore()
  const [tagInput, setTagInput] = useState('')
  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<TransactionFormValues>({ resolver: zodResolver(transactionSchema) })

  useEffect(() => {
    if (!transaction) return
    reset({ date: transaction.date, merchant: transaction.merchant, category: transaction.category, amount: transaction.amount, type: transaction.type, account: transaction.account, tags: transaction.tags ?? [], receipt: transaction.receipt, source: transaction.source })
    setTagInput('')
  }, [transaction, reset])

  const tags = watch('tags') ?? []
  const submit = async (values: TransactionFormValues) => {
    if (!transaction) return
    try {
      const { source: _source, ...update } = values
      const result = await transactionsService.update(transaction.id, update)
      updateTransaction(result.transaction)
      window.dispatchEvent(new Event('fintrack:transactions-changed'))
      toast.success('Transaction updated')
      onSaved?.()
      onClose()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to update transaction') }
  }
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag) setValue('tags', normalizeTags([...tags, tag]))
    setTagInput('')
  }

  return <Dialog open={Boolean(transaction)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit transaction</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
        <Controller name="type" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="investment">Savings / Investment</SelectItem></SelectContent></Select>} />
        <Input label="Amount" type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount', { valueAsNumber: true })} />
        <Input label="Merchant / source" error={errors.merchant?.message} {...register('merchant')} />
        <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
        <Controller name="category" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Category" error={errors.category?.message}><SelectValue /></SelectTrigger><SelectContent>{(state?.settings.categories ?? []).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>} />
        <Controller name="account" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger label="Account" error={errors.account?.message}><SelectValue /></SelectTrigger><SelectContent>{(state?.settings.accounts ?? []).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>} />
        <div><label className="mb-1.5 block text-sm font-medium">Tags</label><div className="mb-2 flex flex-wrap gap-1.5">{tags.map((tag) => <button key={tag} type="button" onClick={() => setValue('tags', tags.filter((value) => value !== tag))} className="rounded-full bg-violet-100 px-2.5 py-1 text-xs text-violet-700" aria-label={`Remove ${tag}`}>{tag} ×</button>)}</div><div className="flex gap-2"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addTag())} className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm" placeholder="Add tag" /><Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button></div></div>
        <Controller name="receipt" control={control} render={({ field }) => <label className="flex items-center gap-2 text-sm"><Checkbox checked={field.value} onCheckedChange={field.onChange} /> Has receipt</label>} />
        <DialogFooter className="gap-2 pt-3"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>Save changes</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
