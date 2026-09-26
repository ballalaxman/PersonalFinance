import React, { useState } from 'react'
import { Edit2, Trash2, Archive, ArchiveRestore, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { useHabitStore } from '@/store/habitStore'
import { formatDate } from '@/utils/dates'
import { cn } from '@/utils/cn'
import type { Habit } from '@/types'
import { HabitFormModal } from './HabitFormModal'
import { HABIT_COLORS, frequencyLabel } from './habitColors'
import { useHabits, type HabitWithStats } from './useHabits'

export default function ManageHabits() {
  const { items, loaded, error, reload } = useHabits()
  const { update, remove } = useHabitStore()
  const [editing, setEditing] = useState<Habit | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!loaded && error) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
        <span>Couldn't load your habits ({error}).</span>
        <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
      </div>
    )
  }
  if (!loaded) return <PageLoader />

  const active = items.filter((i) => !i.habit.archived)
  const archived = items.filter((i) => i.habit.archived)

  const setArchived = async (habit: Habit, value: boolean) => {
    try {
      await update(habit.id, { archived: value })
      toast.success(value ? `"${habit.name}" archived` : `"${habit.name}" restored`)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update habit') }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      toast.success('Habit deleted')
      setDeleteTarget(null)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete habit') } finally { setDeleting(false) }
  }

  const row = (item: HabitWithStats) => {
    const { habit, stats } = item
    const unit = habit.frequency === 'daily' ? 'd' : 'w'
    return (
      <li key={habit.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full', HABIT_COLORS[habit.color].dot)} aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{habit.name}</p>
            <p className="text-xs text-muted-foreground">
              {frequencyLabel(habit.frequency, habit.targetPerWeek)} · tracking since {formatDate(item.createdDate, 'd MMM yyyy')}
              {habit.description && <> · {habit.description}</>}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center text-xs sm:w-64">
          <div><dt className="text-muted-foreground">Streak</dt><dd className="font-semibold tabular-nums">{stats.currentStreak}{unit}</dd></div>
          <div><dt className="text-muted-foreground">Best</dt><dd className="font-semibold tabular-nums">{stats.bestStreak}{unit}</dd></div>
          <div><dt className="text-muted-foreground">30 days</dt><dd className="font-semibold tabular-nums">{stats.completionRate}%</dd></div>
        </dl>
        <div className="flex gap-1 self-end sm:self-auto">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${habit.name}`} onClick={() => { setEditing(habit); setFormOpen(true) }}><Edit2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={habit.archived ? `Restore ${habit.name}` : `Archive ${habit.name}`} title={habit.archived ? 'Restore' : 'Archive'} onClick={() => setArchived(habit, !habit.archived)}>
            {habit.archived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${habit.name}`} className="hover:text-red-500" onClick={() => setDeleteTarget(habit)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage habits</h1>
        <p className="text-sm text-muted-foreground">Edit, archive, or delete habits. Archiving keeps the history.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Active ({active.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {active.length === 0
            ? <div className="p-5"><EmptyState icon={<ListChecks className="h-6 w-6" aria-hidden="true" />} title="No active habits" description="Create one to start tracking." className="border-0" /></div>
            : <ul role="list" className="divide-y divide-border">{active.map(row)}</ul>}
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2"><CardTitle>Archived</CardTitle><Badge variant="secondary">{archived.length}</Badge></CardHeader>
          <CardContent className="p-0"><ul role="list" className="divide-y divide-border opacity-80">{archived.map(row)}</ul></CardContent>
        </Card>
      )}

      <HabitFormModal open={formOpen} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete habit</DialogTitle>
            <DialogDescription>Delete "{deleteTarget?.name}" and all of its check-ins? This can't be undone. Archive it instead to keep the history.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" loading={deleting} onClick={confirmDelete}>Delete habit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
