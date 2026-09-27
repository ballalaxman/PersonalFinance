import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  PiggyBank,
  ArrowRight,
  Info,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PeriodSelector } from './PeriodSelector'
import { CashFlowChart } from './CashFlowChart'
import { SpendingChart } from './SpendingChart'
import { useAppStore } from '@/store/appStore'
import { currentMonth, formatDate, resolveDashboardRange, today } from '@/utils/dates'
import { formatCurrency } from '@/utils/currency'
import { computeCashFlow } from '@/utils/cashflow'
import { Button } from '@/components/ui/Button'
import type { Transaction } from '@/types'
import { CATEGORY_COLORS } from '@/utils/constants'
import { dashboardService, type DashboardData } from '@/services/dashboard'

const EMPTY_DASHBOARD: DashboardData = { summary: { count: 0, incomeCount: 0, expenseCount: 0, needsReviewCount: 0, income: 0, expense: 0, investment: 0 }, daily: [], categories: [], recent: [] }

export default function Dashboard() {
  const { state } = useAppStore()
  const period       = state?.settings.selectedPeriod  ?? 'this-month'
  const selectedMonth = state?.settings.selectedMonth  ?? currentMonth()
  const { startDate, endDate } = useMemo(() => resolveDashboardRange(period, selectedMonth), [period, selectedMonth])
  // null = nothing loaded for this period yet: show placeholders, never fake zeros
  const [data, setData] = useState<DashboardData | null>(() => dashboardService.cached(startDate, endDate) ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Show the last known figures for this period straight away, then refresh them
    setData(dashboardService.cached(startDate, endDate) ?? null)
    dashboardService.get(startDate, endDate)
      .then((result) => { if (!cancelled) { setData(result); setLoadError(null) } })
      .catch((err) => { if (!cancelled) { setData((prev) => prev ?? EMPTY_DASHBOARD); setLoadError(err instanceof Error ? err.message : 'Request failed') } })
    return () => { cancelled = true }
  }, [startDate, endDate, refreshKey])

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1)
    window.addEventListener('fintrack:transactions-changed', refresh)
    return () => window.removeEventListener('fintrack:transactions-changed', refresh)
  }, [])

  const loading = data === null
  const view = data ?? EMPTY_DASHBOARD
  const money = (value: number) => loading ? <Skeleton className="h-6 w-24 sm:h-7 sm:w-32" /> : formatCurrency(value)
  const count = (n: number) => loading ? '…' : `${n} transaction${n !== 1 ? 's' : ''}`

  const income      = view.summary.income
  const spending    = view.summary.expense
  const investments = view.summary.investment

  const { cashSurplus, unallocated, savingsRate, investmentRate } = computeCashFlow({ income, expense: spending, investment: investments })

  const recentActivity = view.recent
  const needsReviewCount = view.summary.needsReviewCount

  // Category spending for insight
  const topCategory = view.categories[0] ?? null

  // Upcoming confirmed recurring
  const upcomingRecurring = useMemo(() => {
    const all = (state?.recurringSchedules ?? []).filter((r) => r.active)
    const todayDate = today()
    return all
      .filter((r) => r.nextDueDate >= todayDate)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
      .slice(0, 3)
  }, [state?.recurringSchedules])

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your financial overview</p>
        </div>
        <PeriodSelector />
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>Couldn't load figures for this period ({loadError}). The totals below are not your real numbers.</span>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {/* Cash surplus */}
        <SummaryCard
          title="Cash surplus"
          icon={<PiggyBank className="h-5 w-5 text-violet-600" aria-hidden="true" />}
          iconBg="bg-violet-50"
        >
          <p className={`text-lg sm:text-2xl font-bold tabular-nums break-words ${cashSurplus >= 0 ? 'text-foreground' : 'text-red-600'}`}>
            {money(cashSurplus)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Income − expenses
          </p>
        </SummaryCard>

        {/* Income */}
        <SummaryCard
          title="Income"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
          iconBg="bg-emerald-50"
        >
          <p className="text-lg sm:text-2xl font-bold tabular-nums break-words text-emerald-600">{money(income)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {count(view.summary.incomeCount)}
          </p>
        </SummaryCard>

        {/* Spending */}
        <SummaryCard
          title="Spending"
          icon={<TrendingDown className="h-5 w-5 text-orange-500" aria-hidden="true" />}
          iconBg="bg-orange-50"
        >
          <p className="text-lg sm:text-2xl font-bold tabular-nums break-words text-orange-500">{money(spending)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {count(view.summary.expenseCount)}
          </p>
        </SummaryCard>

        {/* Savings Rate */}
        <SummaryCard
          title="Invested savings"
          icon={<IndianRupee className="h-5 w-5 text-blue-600" aria-hidden="true" />}
          iconBg="bg-blue-50"
        >
          <p className="text-lg sm:text-2xl font-bold tabular-nums break-words text-blue-600">{money(investments)}</p>
          <p className="mt-1 text-xs text-muted-foreground">SIPs, EPF/PPF, stocks and deposits</p>
        </SummaryCard>
      </div>

      <Card>
        <CardHeader><CardTitle>Savings summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Savings rate</p>
              <p className="text-xl font-bold text-violet-600">
                {loading ? <Skeleton className="h-6 w-16" /> : income > 0 ? `${savingsRate.toFixed(1)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">% of income not spent</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Investment rate</p>
              <p className="text-xl font-bold text-blue-600">
                {loading ? <Skeleton className="h-6 w-16" /> : income > 0 ? `${investmentRate.toFixed(1)}%` : '0%'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">% of income invested</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unallocated savings</p>
              <p className={`text-xl font-bold ${unallocated >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {money(unallocated)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Cash surplus − investments</p>
            </div>
          </div>
          {loading ? null : cashSurplus < 0 ? (
            <p className="mt-3 text-sm text-red-600">
              Expenses exceed income this period.
            </p>
          ) : unallocated < 0 && (
            <p className="mt-3 text-sm text-red-600">
              Investments exceed this period's cash surplus.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] w-full" /> : <CashFlowChart points={view.daily} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] w-full" /> : <SpendingChart categories={view.categories} />}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Recent activity</CardTitle>
            {view.summary.count > 0 && (
              <Link
                to="/transactions"
                className="flex items-center gap-1 text-sm text-violet-600 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 px-5 pb-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentActivity.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="No transactions yet"
                  description="Add a transaction to see recent activity."
                  className="border-0 py-8"
                />
              </div>
            ) : (
              <ul role="list" className="divide-y divide-border">
                {recentActivity.map((t) => (
                  <TransactionRow key={t.id} transaction={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Insight + Coming up */}
        <div className="space-y-4">
          {/* Insight */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" aria-hidden="true" />
                Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-5 w-full" />
              ) : view.summary.count === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Import or add transactions to see insights.
                </p>
              ) : needsReviewCount > 0 ? (
                <p className="text-sm text-foreground">
                  <span className="font-semibold text-amber-600">{needsReviewCount}</span>{' '}
                  transaction{needsReviewCount !== 1 ? 's' : ''} need{needsReviewCount === 1 ? 's' : ''} category review.{' '}
                  <Link to="/transactions" className="text-violet-600 underline text-xs">
                    Review now
                  </Link>
                </p>
              ) : topCategory ? (
                <p className="text-sm text-foreground">
                  Top spending:{' '}
                  <span className="font-semibold">{topCategory.category}</span> at{' '}
                  <span className="font-semibold">{formatCurrency(topCategory.amount)}</span>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No expense data for this period.</p>
              )}
            </CardContent>
          </Card>

          {/* Coming up */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-500" aria-hidden="true" />
                Coming up
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingRecurring.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No confirmed recurring payments.{' '}
                  <Link to="/recurring" className="text-violet-600 underline">
                    Set up recurring
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2" role="list">
                  {upcomingRecurring.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.nextDueDate, 'MMM d')}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground flex-shrink-0">
                        {formatCurrency(r.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  icon,
  iconBg,
  children,
}: {
  title: string
  icon: React.ReactNode
  iconBg: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
            <div className="mt-1">{children}</div>
          </div>
          <div className={`hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:flex ${iconBg}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const color = CATEGORY_COLORS[t.category] ?? '#64748b'
  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {t.merchant[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{t.merchant}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(t.date, 'MMM d')} · {t.category}
        </p>
      </div>
      <p
        className={`text-sm font-semibold flex-shrink-0 ${
          t.type === 'income' ? 'text-emerald-600' : t.type === 'investment' ? 'text-blue-600' : 'text-foreground'
        }`}
      >
        {t.type === 'income' ? '+' : t.type === 'investment' ? '' : '−'}{formatCurrency(t.amount)}
      </p>
    </li>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`} aria-hidden="true" />
}
