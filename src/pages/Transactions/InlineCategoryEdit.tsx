import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import type { Transaction } from '@/types'

interface InlineCategoryEditProps {
  transaction: Transaction
  categories: string[]
}

export function InlineCategoryEdit({ transaction, categories }: InlineCategoryEditProps) {
  const { updateTransaction } = useAppStore()
  const [saving, setSaving] = useState(false)

  const handleChange = async (newCategory: string) => {
    if (newCategory === transaction.category) return
    setSaving(true)
    try {
      const { transaction: updated } = await transactionsService.update(transaction.id, {
        category: newCategory,
      })
      updateTransaction(updated)
    } catch {
      toast.error('Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select value={transaction.category} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger
        className="h-7 min-h-0 border-transparent bg-transparent px-2 text-xs hover:border-border hover:bg-muted focus:border-violet-600 w-full sm:w-36"
        aria-label={`Category: ${transaction.category}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
