import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, PiggyBank, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { BudgetFormModal } from './BudgetFormModal'
import { useAppStore } from '@/store/appStore'
import { currentMonth, formatMonthLabel, monthDateRange } from '@/utils/dates'
import { formatCurrency, formatPercent } from '@/utils/currency'
import { dashboardService } from '@/services/dashboard'
import type { Budget } from '@/types'

export default function Budgets() {
  const { state, updateSettings } = useAppStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Budget | null>(null)

  const budgets = useMemo(() => state?.settings.budgets ?? [], [state?.settings.budgets])
  const month = currentMonth()
  // Expense totals per category for the whole current month, aggregated on the
  // server — the client transaction cache only holds one (possibly filtered) page.
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({})
  const [spendError, setSpendError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const { startDate, endDate } = monthDateRange(month)
    dashboardService.get(startDate, endDate)
      .then((data) => {
        if (cancelled) return
        setSpendByCategory(Object.fromEntries(data.categories.map((c) => [c.category, Number(c.amount)])))
        setSpendError(false)
      })
      .catch(() => { if (!cancelled) setSpendError(true) })
    return () => { cancelled = true }
  }, [month, refreshKey])

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1)
    window.addEventListener('fintrack:transactions-changed', refresh)
    return () => window.removeEventListener('fintrack:transactions-changed', refresh)
  }, [])

  const budgetData = useMemo(() =>
    budgets.map((b) => {
      const spent = spendByCategory[b.category] ?? 0
      const pct = b.monthlyLimit > 0 ? Math.min((spent / b.monthlyLimit) * 100, 100) : 0
      return { ...b, spent, pct, remaining: b.monthlyLimit - spent, overBudget: spent > b.monthlyLimit }
    }), [budgets, spendByCategory])

  const activeBudgets = budgetData.filter((b) => b.active)
  const overBudgetCount = activeBudgets.filter((b) => b.overBudget).length
  const healthScore = activeBudgets.length > 0
    ? Math.round(((activeBudgets.length - overBudgetCount) / activeBudgets.length) * 100)
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
          <p className="text-sm text-muted-foreground">Monthly spending limits · {formatMonthLabel(month)}</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create budget
        </Button>
      </div>

      {spendError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>Couldn't load this month's spending, so the figures below may be incomplete.</span>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button>
        </div>
      )}

      {/* Health summary */}
      {activeBudgets.length > 0 && (
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

                <div className="grid grid-cols-3 gap-2 text-center tabular-nums [&_p.font-semibold]:text-[13px] [&_p.font-semibold]:leading-snug [&_p.font-semibold]:[overflow-wrap:anywhere]">
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
