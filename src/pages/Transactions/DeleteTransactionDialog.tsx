import React, { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import { formatCurrency } from '@/utils/currency'
import type { Transaction } from '@/types'

interface DeleteTransactionDialogProps {
  transaction: Transaction
  onClose: () => void
  onDeleted?: () => void
}

export function DeleteTransactionDialog({ transaction, onClose, onDeleted }: DeleteTransactionDialogProps) {
  const { removeTransaction } = useAppStore()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await transactionsService.delete(transaction.id)
      removeTransaction(transaction.id)
      toast.success('Transaction deleted')
      onDeleted?.()
      onClose()
    } catch {
      toast.error('Failed to delete transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            Delete transaction
          </DialogTitle>
          <DialogDescription>
            Delete <strong>{transaction.merchant}</strong> for{' '}
            <strong>{formatCurrency(transaction.amount)}</strong> on {transaction.date}? This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} loading={loading}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
