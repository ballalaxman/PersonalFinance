import React, { useState } from 'react'
import { Plus, Edit2, Trash2, CheckCircle2, Clock3, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { useAppStore } from '@/store/appStore'
import { recurringService, type RecurringScheduleInput } from '@/services/recurring'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/dates'
import type { RecurringOccurrence, RecurringSchedule } from '@/types'
import { RecurringFormModal } from './RecurringFormModal'

export default function Recurring() {
  const { state, loadState } = useAppStore()
  const schedules = state?.recurringSchedules ?? []
  const occurrences = state?.recurringOccurrences ?? []
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringSchedule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [postpone, setPostpone] = useState<Record<string, string>>({})
  // Actual amount to record on confirm; defaults to the expected amount (variable bills differ)
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const save = async (input: RecurringScheduleInput) => {
    try {
      if (editing) await recurringService.update(editing.id, input)
      else await recurringService.create(input)
      toast.success(editing ? 'Schedule updated' : 'Schedule created')
      setOpen(false); setEditing(null); await loadState()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save schedule') }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await recurringService.remove(deleteTarget.id)
      toast.success('Schedule deleted')
      setDeleteTarget(null)
      await loadState()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete schedule')
    } finally {
      setDeleting(false)
    }
  }

  const resolve = async (action: 'confirm' | 'skip' | 'postpone', occurrence: RecurringOccurrence) => {
    try {
      if (action === 'confirm') {
        const raw = amounts[occurrence.id]
        const amount = raw === undefined || raw === '' ? occurrence.expectedAmount : Number(raw)
        if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter an amount greater than zero')
        await recurringService.confirm(occurrence.id, { amount })
        window.dispatchEvent(new Event('fintrack:transactions-changed'))
      }
      if (action === 'skip') await recurringService.skip(occurrence.id)
      if (action === 'postpone') {
        const date = postpone[occurrence.id]
        if (!date) return toast.error('Select a postpone date')
        await recurringService.postpone(occurrence.id, date)
      }
      toast.success(action === 'confirm' ? 'Transaction confirmed' : action === 'skip' ? 'Occurrence skipped' : 'Reminder postponed')
      await loadState()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to reconcile occurrence') }
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Recurring</h1><p className="text-sm text-muted-foreground">Scheduled income, expenses, and investments</p></div><Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="h-4 w-4" />Add recurring</Button></div>

    <Card className={occurrences.length ? 'border-amber-200 bg-amber-50/40' : ''}>
      <CardHeader><CardTitle>Needs confirmation ({occurrences.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!occurrences.length ? <div className="p-5"><EmptyState title="Nothing to reconcile" description="Due recurring items will appear here before becoming transactions." className="border-0" /></div> : <ul className="divide-y divide-border">{occurrences.map((o) => <li key={o.id} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="font-medium">{o.scheduleName ?? 'Recurring transaction'}</p><p className="text-xs text-muted-foreground">Due {formatDate(o.dueDate)} · expected {formatCurrency(o.expectedAmount)}</p></div><Badge variant={o.status === 'postponed' ? 'warning' : 'secondary'}>{o.status}</Badge></div>
          <div className="flex flex-wrap items-end gap-2">
            <Input type="number" step="0.01" min="0.01" label="Actual amount" value={amounts[o.id] ?? String(o.expectedAmount)} onChange={(e) => setAmounts((a) => ({ ...a, [o.id]: e.target.value }))} className="w-36" />
            <Button size="sm" onClick={() => resolve('confirm', o)}><CheckCircle2 className="h-4 w-4" />Confirm</Button>
            <Button size="sm" variant="outline" onClick={() => resolve('skip', o)}><X className="h-4 w-4" />Skip</Button>
            <Input type="date" label="Postpone until" value={postpone[o.id] ?? ''} onChange={(e) => setPostpone((p) => ({ ...p, [o.id]: e.target.value }))} className="w-40" />
            <Button size="sm" variant="outline" onClick={() => resolve('postpone', o)}><Clock3 className="h-4 w-4" />Postpone</Button>
          </div>
        </li>)}</ul>}
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Scheduled ({schedules.length})</CardTitle></CardHeader><CardContent className="p-0">{!schedules.length ? <div className="p-5"><EmptyState title="No recurring schedules" description="Add a schedule for bills, income, SIPs, EPF, or other investments." className="border-0" /></div> : <ul className="divide-y divide-border">{schedules.map((s) => <li key={s.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex gap-2"><p className="font-medium truncate">{s.name}</p><Badge variant={s.active ? 'success' : 'secondary'}>{s.active ? s.transactionType : 'paused'}</Badge></div><p className="text-xs text-muted-foreground capitalize">{s.cadence} · {s.category} · next {formatDate(s.nextDueDate)}</p></div><p className="font-semibold">{formatCurrency(s.amount)}</p><Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setOpen(true) }}><Edit2 className="h-4 w-4" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Delete ${s.name}`} className="hover:text-red-500" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4" /></Button></li>)}</ul>}</CardContent></Card>

    <RecurringFormModal open={open} initial={editing} onClose={() => { setOpen(false); setEditing(null) }} onSave={save} />

    <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
          <DialogDescription>
            Delete "{deleteTarget?.name}" and its pending confirmations? Transactions already confirmed from it are kept. To stop it temporarily, edit it and turn off Active instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleting} onClick={confirmDelete}>Delete schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
