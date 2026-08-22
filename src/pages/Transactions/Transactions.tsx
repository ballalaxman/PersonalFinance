import React, { useEffect, useMemo, useState } from 'react'
import { Search, Receipt, Pencil } from 'lucide-react'
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
import { TransactionEditModal } from './TransactionEditModal'
import { useAppStore } from '@/store/appStore'
import { currentMonth, formatDate, monthDateRange } from '@/utils/dates'
import { formatCurrency } from '@/utils/currency'
import type { Transaction } from '@/types'
import { transactionsService, type TransactionListQuery, type TransactionTotals } from '@/services/transactions'

export default function Transactions() {
  const { state, replaceTransactions, appendTransactions } = useAppStore()
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totals, setTotals] = useState<TransactionTotals>({ count: 0, income: 0, expense: 0, investment: 0 })
  const [refreshKey, setRefreshKey] = useState(0)

  const month = state?.settings.selectedMonth ?? currentMonth()
  const query = useMemo<TransactionListQuery>(() => {
    const range = monthDateRange(month)
    return {
      ...range,
      search: search.trim() || undefined,
      account: accountFilter === 'all' ? undefined : accountFilter,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      type: typeFilter === 'all' ? undefined : typeFilter as Transaction['type'],
    }
  }, [month, search, accountFilter, categoryFilter, typeFilter])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      transactionsService.list(query).then((page) => {
        if (cancelled) return
        replaceTransactions(page.transactions)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setTotals(page.totals)
      }).catch(() => !cancelled && toast.error('Failed to load transactions'))
    }, search.trim() ? 250 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, replaceTransactions, refreshKey])

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1)
    window.addEventListener('fintrack:transactions-changed', refresh)
    return () => window.removeEventListener('fintrack:transactions-changed', refresh)
  }, [])

  const allTransactions = state?.transactions ?? []
  const categories = state?.settings.categories ?? []
  const accounts = state?.settings.accounts ?? []

  const filtered = allTransactions
  const totalIncome = totals.income
  const totalExpense = totals.expense
  const totalInvestment = totals.investment

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">{totals.count} records</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Spending</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Invested</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(totalInvestment)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Cash surplus</p>
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="investment">Savings / Investment</SelectItem>
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
                    ? 'Use the Add entry button to get started.'
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
                    onEdit={() => setEditTarget(t)}
                    onDelete={() => setDeleteTarget(t)}
                  />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {hasMore && <div className="flex justify-center"><Button variant="outline" loading={loadingMore} onClick={async () => {
        if (!nextCursor) return
        setLoadingMore(true)
        try {
          const page = await transactionsService.list({ ...query, cursor: nextCursor })
          appendTransactions(page.transactions)
          setNextCursor(page.nextCursor)
          setHasMore(page.hasMore)
        } finally { setLoadingMore(false) }
      }}>Load more</Button></div>}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteTransactionDialog
          transaction={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => setRefreshKey((value) => value + 1)}
        />
      )}
      <TransactionEditModal transaction={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  )
}

function TransactionRow({
  transaction: t,
  categories,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  categories: string[]
  onEdit: () => void
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
            t.type === 'income' ? 'text-emerald-600' : t.type === 'investment' ? 'text-blue-600' : 'text-foreground'
          }`}
        >
          {t.type === 'income' ? '+' : t.type === 'investment' ? '' : '−'}{formatCurrency(t.amount)}
        </p>

        <button
          onClick={onEdit}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-violet-600 hover:bg-violet-50 transition-all"
          aria-label={`Edit transaction ${t.merchant}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
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
                t.type === 'income' ? 'text-emerald-600' : t.type === 'investment' ? 'text-blue-600' : 'text-foreground'
              }`}
            >
              {t.type === 'income' ? '+' : t.type === 'investment' ? '' : '−'}{formatCurrency(t.amount)}
            </p>
            <button
              onClick={onEdit}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
              aria-label={`Edit ${t.merchant}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
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
