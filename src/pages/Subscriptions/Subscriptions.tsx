import React, { useMemo, useState } from 'react'
import { CheckCircle2, X, Plus, Edit2, Trash2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SubscriptionFormModal } from './SubscriptionFormModal'
import { useAppStore } from '@/store/appStore'
import { detectRecurring } from '@/utils/recurringDetection'
import { formatCurrency, toMonthlyEquivalent } from '@/utils/currency'
import { formatDate } from '@/utils/dates'
import type { RecurringSuggestion, Subscription } from '@/types'
import { nanoid } from '@/utils/nanoid'

export default function Subscriptions() {
  const { state, updateSettings } = useAppStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Subscription | null>(null)

  const transactions = state?.transactions ?? []
  const dismissed = state?.settings.dismissedPatterns ?? []
  const confirmed = state?.settings.subscriptions ?? []

  const suggestions = useMemo(
    () => detectRecurring(transactions, dismissed).filter((s) => s.isSubscription),
    [transactions, dismissed]
  )

  const monthlyTotal = useMemo(
    () => confirmed.filter((s) => s.active).reduce((sum, s) => sum + toMonthlyEquivalent(s.amount, s.cadence), 0),
    [confirmed]
  )
  const annualTotal = monthlyTotal * 12

  const handleKeep = async (s: RecurringSuggestion) => {
    const newSub: Subscription = {
      id: nanoid(),
      name: s.merchant,
      category: s.category,
      amount: s.averageAmount,
      cadence: s.cadence,
      nextDate: s.nextExpectedDate,
      active: true,
    }
    try {
      await updateSettings({ subscriptions: [...confirmed, newSub] })
      toast.success(`${s.merchant} added to subscriptions`)
    } catch { /* handled */ }
  }

  const handleIgnore = async (s: RecurringSuggestion) => {
    try {
      await updateSettings({ dismissedPatterns: [...dismissed, s.key] })
      toast.info(`${s.merchant} hidden`)
    } catch { /* handled */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await updateSettings({ subscriptions: confirmed.filter((s) => s.id !== id) })
      toast.success('Subscription removed')
    } catch { /* handled */ }
  }

  const handleSave = async (entry: Subscription) => {
    const isEdit = confirmed.some((s) => s.id === entry.id)
    try {
      await updateSettings({
        subscriptions: isEdit
          ? confirmed.map((s) => (s.id === entry.id ? entry : s))
          : [...confirmed, entry],
      })
      setFormOpen(false)
      setEditTarget(null)
    } catch { /* handled */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">Recurring service payments</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add subscription
        </Button>
      </div>

      {/* Totals */}
      {confirmed.filter((s) => s.active).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Monthly total</p>
            <p className="text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Annual total</p>
            <p className="text-xl font-bold">{formatCurrency(annualTotal)}</p>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected subscriptions ({suggestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border" role="list">
              {suggestions.map((s) => (
                <li key={s.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{s.merchant}</p>
                      <Badge variant={s.confidence === 'high' ? 'success' : 'warning'}>
                        {s.confidence === 'high' ? 'High confidence' : 'Likely'}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">{s.cadence}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.occurrenceCount}× · avg {formatCurrency(s.averageAmount)} ·{' '}
                      {formatCurrency(s.monthlyEquivalent)}/mo · next {formatDate(s.nextExpectedDate, 'MMM d')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleIgnore(s)}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Ignore
                    </Button>
                    <Button size="sm" onClick={() => handleKeep(s)}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Keep
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Confirmed */}
      <Card>
        <CardHeader><CardTitle>Your subscriptions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {confirmed.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CreditCard className="h-6 w-6" aria-hidden="true" />}
                title="No subscriptions"
                description="Keep a detected subscription or add one manually."
                className="border-0"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {confirmed.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      {!s.active && <Badge variant="secondary">Paused</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {s.cadence} · {s.category} · next {formatDate(s.nextDate, 'MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(s.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(toMonthlyEquivalent(s.amount, s.cadence))}/mo</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(s); setFormOpen(true) }} aria-label="Edit">
                      <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(s.id)} aria-label="Delete" className="hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SubscriptionFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />
    </div>
  )
}
