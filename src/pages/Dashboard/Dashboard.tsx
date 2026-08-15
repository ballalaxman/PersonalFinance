import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  PiggyBank,
  Settings,
  ArrowRight,
  Info,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PeriodSelector } from './PeriodSelector'
import { CashFlowChart } from './CashFlowChart'
import { SpendingChart } from './SpendingChart'
import { useAppStore } from '@/store/appStore'
import { filterByPeriod, formatDate } from '@/utils/dates'
import { formatCurrency, calcSavingsRate } from '@/utils/currency'
import type { Transaction } from '@/types'
import { CATEGORY_COLORS } from '@/utils/constants'

export default function Dashboard() {
  const { state } = useAppStore()

  const period = state?.settings.selectedPeriod ?? 'all-time'
  const allTransactions = state?.transactions ?? []

  const filtered = useMemo(
    () => filterByPeriod(allTransactions, period),
    [allTransactions, period]
  )

  const income = useMemo(
    () => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [filtered]
  )
  const spending = useMemo(
    () => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [filtered]
  )
  const savingsRate = calcSavingsRate(income, spending)

  const netWorthConfigured = state?.settings.netWorthConfigured ?? false
  const assets = state?.settings.assets ?? 0
  const liabilities = state?.settings.liabilities ?? 0
  const netWorth = assets - liabilities

  const recentActivity = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [filtered]
  )

  const needsReviewCount = filtered.filter((t) => t.category === 'Needs review').length

  // Category spending for insight
  const topCategory = useMemo(() => {
    if (!filtered.length) return null
    const map: Record<string, number> = {}
    for (const t of filtered.filter((t) => t.type === 'expense')) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    return entries[0] ?? null
  }, [filtered])

  // Upcoming confirmed recurring
  const upcomingRecurring = useMemo(() => {
    const recurring = state?.settings.recurring ?? []
    const subs = state?.settings.subscriptions ?? []
    const all = [
      ...recurring.filter((r) => r.active),
      ...subs.filter((s) => s.active),
    ]
    const today = new Date().toISOString().split('T')[0]
    return all
      .filter((r) => r.nextDate >= today)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .slice(0, 3)
  }, [state?.settings.recurring, state?.settings.subscriptions])

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

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Net Worth */}
        <SummaryCard
          title="Net Worth"
          icon={<PiggyBank className="h-5 w-5 text-violet-600" aria-hidden="true" />}
          iconBg="bg-violet-50"
        >
          {netWorthConfigured ? (
            <>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                {formatCurrency(netWorth)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assets {formatCurrency(assets)} − Liabilities {formatCurrency(liabilities)}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-muted-foreground">Not set</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure in{' '}
                <Link to="/settings" className="text-violet-600 underline">
                  Settings
                </Link>
              </p>
            </>
          )}
        </SummaryCard>

        {/* Income */}
        <SummaryCard
          title="Income"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
          iconBg="bg-emerald-50"
        >
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(income)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.filter((t) => t.type === 'income').length} transaction
            {filtered.filter((t) => t.type === 'income').length !== 1 ? 's' : ''}
          </p>
        </SummaryCard>

        {/* Spending */}
        <SummaryCard
          title="Spending"
          icon={<TrendingDown className="h-5 w-5 text-orange-500" aria-hidden="true" />}
          iconBg="bg-orange-50"
        >
          <p className="text-2xl font-bold text-orange-500">{formatCurrency(spending)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.filter((t) => t.type === 'expense').length} transaction
            {filtered.filter((t) => t.type === 'expense').length !== 1 ? 's' : ''}
          </p>
        </SummaryCard>

        {/* Savings Rate */}
        <SummaryCard
          title="Savings Rate"
          icon={<IndianRupee className="h-5 w-5 text-blue-600" aria-hidden="true" />}
          iconBg="bg-blue-50"
        >
          <p className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {income === 0 ? '0%' : `${savingsRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {income === 0 ? 'No income recorded' : `(Income − Spending) ÷ Income`}
          </p>
        </SummaryCard>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart transactions={allTransactions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart transactions={filtered} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Recent activity</CardTitle>
            {allTransactions.length > 0 && (
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
            {recentActivity.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="No transactions yet"
                  description="Add a transaction or import a CSV to see recent activity."
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
              {filtered.length === 0 ? (
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
                  <span className="font-semibold">{topCategory[0]}</span> at{' '}
                  <span className="font-semibold">{formatCurrency(topCategory[1])}</span>.
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
                        <p className="text-xs text-muted-foreground">{formatDate(r.nextDate, 'MMM d')}</p>
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
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-1">{children}</div>
          </div>
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
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
          t.type === 'income' ? 'text-emerald-600' : 'text-foreground'
        }`}
      >
        {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
      </p>
    </li>
  )
}
