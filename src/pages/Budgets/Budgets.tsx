import React, { useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, PiggyBank, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { BudgetFormModal } from './BudgetFormModal'
import { useAppStore } from '@/store/appStore'
import { filterByPeriod, getDateRange } from '@/utils/dates'
import { formatCurrency, formatPercent } from '@/utils/currency'
import { startOfMonth, endOfMonth } from 'date-fns'
import type { Budget, Transaction } from '@/types'
import { nanoid } from '@/utils/nanoid'

export default function Budgets() {
  const { state, updateSettings } = useAppStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Budget | null>(null)

  const budgets = state?.settings.budgets ?? []
  const transactions = state?.transactions ?? []

  // Budgets always calculated against the current month
  const thisMonthTransactions = useMemo(() => {
    const now = new Date()
    return transactions.filter((t) => {
      return t.date >= startOfMonth(now).toISOString().split('T')[0] &&
             t.date <= endOfMonth(now).toISOString().split('T')[0]
    })
  }, [transactions])

  const budgetData = useMemo(() =>
    budgets.map((b) => {
      const spent = thisMonthTransactions
        .filter((t) => t.type === 'expense' && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0)
      const pct = b.monthlyLimit > 0 ? Math.min((spent / b.monthlyLimit) * 100, 100) : 0
      return { ...b, spent, pct, remaining: b.monthlyLimit - spent, overBudget: spent > b.monthlyLimit }
    }), [budgets, thisMonthTransactions])

  const overBudgetCount = budgetData.filter((b) => b.overBudget && b.active).length
  const healthScore = budgets.length > 0
    ? Math.round(((budgets.length - overBudgetCount) / budgets.length) * 100)
    : 0

  const handleSave = async (budget: Budget) => {
    const isEdit = budgets.some((b) => b.id === budget.id)
    try {
      await updateSettings({
        budgets: isEdit ? budgets.map((b) => (b.id === budget.id ? budget : b)) : [...budgets, budget],
      })
      setFormOpen(false)
      setEditTarget(null)
    } catch { /* handled */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await updateSettings({ budgets: budgets.filter((b) => b.id !== id) })
      toast.success('Budget removed')
    } catch { /* handled */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Monthly spending limits</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create budget
        </Button>
      </div>

      {/* Health summary */}
      {budgets.length > 0 && (
        <Card className={overBudgetCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}>
          <CardContent className="flex items-center gap-4 py-4">
            {overBudgetCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" aria-hidden="true" />
            ) : (
              <PiggyBank className="h-5 w-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {overBudgetCount > 0
                  ? `${overBudgetCount} budget${overBudgetCount !== 1 ? 's' : ''} over limit`
                  : 'All budgets on track'}
              </p>
              <p className="text-xs text-muted-foreground">
                {healthScore}% of budgets within limit this month
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget cards */}
      {budgetData.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" aria-hidden="true" />}
          title="No budgets yet"
          description="Create a budget to track spending limits by category."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgetData.map((b) => (
            <Card key={b.id} className={b.overBudget && b.active ? 'border-red-200' : ''}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold">{b.category}</p>
                    {!b.active && <Badge variant="secondary" className="mt-1">Paused</Badge>}
                    {b.overBudget && b.active && (
                      <Badge variant="destructive" className="mt-1">Over budget</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(b); setFormOpen(true) }} aria-label="Edit budget">
                      <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(b.id)} aria-label="Delete budget" className="hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <Progress
                  value={b.pct}
                  className="mb-3"
                  indicatorClassName={
                    b.overBudget ? 'bg-red-500' : b.pct > 80 ? 'bg-orange-500' : 'bg-violet-600'
                  }
                  aria-label={`${b.category} budget: ${b.pct.toFixed(0)}%`}
                />

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="text-sm font-semibold">{formatCurrency(b.spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Limit</p>
                    <p className="text-sm font-semibold">{formatCurrency(b.monthlyLimit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Left</p>
                    <p className={`text-sm font-semibold ${b.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(Math.abs(b.remaining))}
                      {b.remaining < 0 ? ' over' : ''}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">{formatPercent(b.pct, 0)} used</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BudgetFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />
    </div>
  )
}
