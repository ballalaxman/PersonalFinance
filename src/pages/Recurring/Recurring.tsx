import React, { useMemo, useState } from 'react'
import { CheckCircle2, X, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { RecurringFormModal } from './RecurringFormModal'
import { useAppStore } from '@/store/appStore'
import { detectRecurring } from '@/utils/recurringDetection'
import { formatCurrency, toMonthlyEquivalent } from '@/utils/currency'
import { formatDate } from '@/utils/dates'
import type { RecurringSuggestion, RecurringPayment } from '@/types'
import { nanoid } from '@/utils/nanoid'

export default function Recurring() {
  const { state, updateSettings } = useAppStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RecurringPayment | null>(null)

  const transactions = state?.transactions ?? []
  const dismissed = state?.settings.dismissedPatterns ?? []
  const confirmed = state?.settings.recurring ?? []

  const suggestions = useMemo(
    () => detectRecurring(transactions, dismissed).filter((s) => !s.isSubscription),
    [transactions, dismissed]
  )

  const monthlyTotal = useMemo(
    () => confirmed.filter((r) => r.active).reduce((s, r) => s + toMonthlyEquivalent(r.amount, r.cadence), 0),
    [confirmed]
  )
  const annualTotal = monthlyTotal * 12

  const handleKeep = async (s: RecurringSuggestion) => {
    const newEntry: RecurringPayment = {
      id: nanoid(),
      name: s.merchant,
      category: s.category,
      amount: s.averageAmount,
      cadence: s.cadence,
      nextDate: s.nextExpectedDate,
      active: true,
    }
    try {
      await updateSettings({ recurring: [...confirmed, newEntry] })
      toast.success(`${s.merchant} added to recurring`)
    } catch { /* handled in store */ }
  }

  const handleIgnore = async (s: RecurringSuggestion) => {
    try {
      await updateSettings({ dismissedPatterns: [...dismissed, s.key] })
      toast.info(`${s.merchant} hidden from suggestions`)
    } catch { /* handled in store */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await updateSettings({ recurring: confirmed.filter((r) => r.id !== id) })
      toast.success('Recurring payment removed')
    } catch { /* handled in store */ }
  }

  const handleSave = async (entry: RecurringPayment) => {
    const isEdit = confirmed.some((r) => r.id === entry.id)
    try {
      await updateSettings({
        recurring: isEdit
          ? confirmed.map((r) => (r.id === entry.id ? entry : r))
          : [...confirmed, entry],
      })
      setFormOpen(false)
      setEditTarget(null)
    } catch { /* handled in store */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring</h1>
          <p className="text-sm text-muted-foreground">Automatic payment patterns</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add recurring
        </Button>
      </div>

      {/* Detection banner */}
      <Card className="border-violet-200 bg-violet-50">
        <CardContent className="flex items-center gap-3 py-4">
          <RefreshCw className="h-5 w-5 text-violet-600 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-violet-800">
            <span className="font-semibold">Active detection</span> — FinTrack analyses your
            transactions to find recurring payment patterns.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      {confirmed.filter((r) => r.active).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Monthly commitment</p>
            <p className="text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Annual commitment</p>
            <p className="text-xl font-bold">{formatCurrency(annualTotal)}</p>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected patterns ({suggestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border" role="list">
              {suggestions.map((s) => (
                <SuggestionRow key={s.key} suggestion={s} onKeep={handleKeep} onIgnore={handleIgnore} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Confirmed list */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmed recurring</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {confirmed.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No recurring payments"
                description="Keep a suggestion or add one manually."
                className="border-0"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {confirmed.map((r) => (
                <RecurringRow
                  key={r.id}
                  entry={r}
                  onEdit={() => { setEditTarget(r); setFormOpen(true) }}
                  onDelete={() => handleDelete(r.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RecurringFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />
    </div>
  )
}

function SuggestionRow({
  suggestion: s,
  onKeep,
  onIgnore,
}: {
  suggestion: RecurringSuggestion
  onKeep: (s: RecurringSuggestion) => void
  onIgnore: (s: RecurringSuggestion) => void
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{s.merchant}</p>
          <Badge variant={s.confidence === 'high' ? 'success' : 'warning'}>
            {s.confidence === 'high' ? 'High confidence' : 'Likely'}
          </Badge>
          <Badge variant="secondary" className="capitalize">{s.cadence}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {s.occurrenceCount} occurrences · avg {formatCurrency(s.averageAmount)} ·{' '}
          {formatCurrency(s.monthlyEquivalent)}/mo · next {formatDate(s.nextExpectedDate, 'MMM d')}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={() => onIgnore(s)} aria-label="Ignore suggestion">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Ignore
        </Button>
        <Button size="sm" onClick={() => onKeep(s)} aria-label="Keep as recurring">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Keep
        </Button>
      </div>
    </li>
  )
}

function RecurringRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: RecurringPayment
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{entry.name}</p>
          {!entry.active && <Badge variant="secondary">Paused</Badge>}
        </div>
        <p className="text-xs text-muted-foreground capitalize">
          {entry.cadence} · {entry.category} · next {formatDate(entry.nextDate, 'MMM d')}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold">{formatCurrency(entry.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(toMonthlyEquivalent(entry.amount, entry.cadence))}/mo
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit">
          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete" className="hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
