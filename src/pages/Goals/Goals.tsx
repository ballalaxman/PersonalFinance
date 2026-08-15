import React, { useState } from 'react'
import { Plus, Edit2, Trash2, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { GoalFormModal } from './GoalFormModal'
import { useAppStore } from '@/store/appStore'
import { formatCurrency, formatPercent } from '@/utils/currency'
import { formatDate } from '@/utils/dates'
import { nanoid } from '@/utils/nanoid'
import type { Goal } from '@/types'

export default function Goals() {
  const { state, updateSettings } = useAppStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Goal | null>(null)

  const goals = state?.settings.goals ?? []

  const handleSave = async (goal: Goal) => {
    const isEdit = goals.some((g) => g.id === goal.id)
    try {
      await updateSettings({
        goals: isEdit ? goals.map((g) => (g.id === goal.id ? goal : g)) : [...goals, goal],
      })
      setFormOpen(false)
      setEditTarget(null)
    } catch { /* handled */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await updateSettings({ goals: goals.filter((g) => g.id !== id) })
      toast.success('Goal removed')
    } catch { /* handled */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-sm text-muted-foreground">Track your financial targets</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" aria-hidden="true" />}
          title="No goals yet"
          description="Set a savings target and track your progress toward it."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const pct = g.targetAmount > 0
              ? Math.min((g.currentSavedAmount / g.targetAmount) * 100, 100)
              : 0
            const remaining = g.targetAmount - g.currentSavedAmount
            return (
              <Card key={g.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{g.name}</p>
                      {g.dueDate && (
                        <p className="text-xs text-muted-foreground">Due {formatDate(g.dueDate, 'MMM d, yyyy')}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(g); setFormOpen(true) }} aria-label="Edit goal">
                        <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(g.id)} aria-label="Delete goal" className="hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatCurrency(g.currentSavedAmount)}</span>
                    <span className="text-sm text-muted-foreground">of {formatCurrency(g.targetAmount)}</span>
                  </div>

                  <Progress
                    value={pct}
                    className="mb-3"
                    indicatorClassName={pct >= 100 ? 'bg-emerald-500' : 'bg-violet-600'}
                    aria-label={`${g.name}: ${pct.toFixed(0)}%`}
                  />

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {remaining > 0 ? `${formatCurrency(remaining)} to go` : 'Goal reached!'}
                    </span>
                    <span className="font-medium text-violet-600">{formatPercent(pct, 0)}</span>
                  </div>

                  {g.note && (
                    <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                      {g.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <GoalFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />
    </div>
  )
}
