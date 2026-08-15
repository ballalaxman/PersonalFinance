import React, { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, Tag, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { PeriodSelector } from '@/pages/Dashboard/PeriodSelector'
import { InlineCategoryEdit } from './InlineCategoryEdit'
import { InlineTagEdit } from './InlineTagEdit'
import { DeleteTransactionDialog } from './DeleteTransactionDialog'
import { useAppStore } from '@/store/appStore'
import { filterByPeriod, formatDate } from '@/utils/dates'
import { formatCurrency } from '@/utils/currency'
import type { Transaction } from '@/types'

export default function Transactions() {
  const { state } = useAppStore()
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const period = state?.settings.selectedPeriod ?? 'all-time'
  const allTransactions = state?.transactions ?? []
  const categories = state?.settings.categories ?? []
  const accounts = state?.settings.accounts ?? []

  const filtered = useMemo(() => {
    let items = filterByPeriod(allTransactions, period)

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    if (accountFilter !== 'all') {
      items = items.filter((t) => t.account === accountFilter)
    }

    if (categoryFilter !== 'all') {
      items = items.filter((t) => t.category === categoryFilter)
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [allTransactions, period, search, accountFilter, categoryFilter])

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} records</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Spending</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-card p-3 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-foreground' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant, category, tag…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 min-h-[44px]"
            aria-label="Search transactions"
          />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by account">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / List */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={allTransactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
                description={
                  allTransactions.length === 0
                    ? 'Use the Add entry button or Import to get started.'
                    : 'Try adjusting your search or filters.'
                }
                className="border-0"
              />
            </div>
          ) : (
            <>
              {/* Desktop table header */}
              <div className="hidden lg:grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Merchant / Date</span>
                <span>Category</span>
                <span>Account</span>
                <span>Tags</span>
                <span className="text-right">Amount</span>
                <span className="w-8" />
              </div>

              {/* Rows */}
              <ul role="list" className="divide-y divide-border">
                {filtered.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    categories={categories}
                    onDelete={() => setDeleteTarget(t)}
                  />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteTransactionDialog
          transaction={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function TransactionRow({
  transaction: t,
  categories,
  onDelete,
}: {
  transaction: Transaction
  categories: string[]
  onDelete: () => void
}) {
  return (
    <li className="group transition-colors hover:bg-muted/30">
      {/* Desktop row */}
      <div className="hidden lg:grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr_auto] gap-4 items-center px-5 py-3">
        {/* Merchant + Date */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{t.merchant}</p>
            {t.receipt && (
              <Receipt className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" aria-label="Has receipt" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
        </div>

        {/* Category inline edit */}
        <InlineCategoryEdit transaction={t} categories={categories} />

        {/* Account */}
        <p className="text-sm text-muted-foreground truncate">{t.account}</p>

        {/* Tags inline edit */}
        <InlineTagEdit transaction={t} />

        {/* Amount */}
        <p
          className={`text-sm font-semibold text-right ${
            t.type === 'income' ? 'text-emerald-600' : 'text-foreground'
          }`}
        >
          {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
        </p>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
          aria-label={`Delete transaction ${t.merchant}`}
        >
          <span aria-hidden="true" className="text-base">×</span>
        </button>
      </div>

      {/* Mobile row */}
      <div className="lg:hidden px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">{t.merchant}</p>
              {t.receipt && (
                <Receipt className="h-3 w-3 flex-shrink-0 text-violet-500" aria-label="Has receipt" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(t.date, 'MMM d')} · {t.account}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p
              className={`text-sm font-semibold ${
                t.type === 'income' ? 'text-emerald-600' : 'text-foreground'
              }`}
            >
              {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
            </p>
            <button
              onClick={onDelete}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50"
              aria-label={`Delete ${t.merchant}`}
            >
              <span aria-hidden="true" className="text-base">×</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <InlineCategoryEdit transaction={t} categories={categories} />
        </div>
        <InlineTagEdit transaction={t} />
      </div>
    </li>
  )
}
