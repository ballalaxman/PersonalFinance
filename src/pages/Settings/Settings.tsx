import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutGrid, CreditCard, RefreshCw,
  Trash2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/Dialog'
import { useAppStore } from '@/store/appStore'
import { useHabitStore } from '@/store/habitStore'
import { api } from '@/services/api'
import { ReminderSettings } from './ReminderSettings'

export default function Settings() {
  const { state, updateSettings, loadState } = useAppStore()
  const navigate = useNavigate()

  const settings = state?.settings
  const [timezone, setTimezone] = useState(settings?.timezone ?? 'Asia/Kolkata')

  const [newCategory, setNewCategory] = useState('')
  const [newAccount, setNewAccount] = useState('')

  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeInput, setWipeInput] = useState('')
  const [wiping, setWiping] = useState(false)

  const categories = settings?.categories ?? []
  const accounts = settings?.accounts ?? []

  // ─── Categories ─────────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    const val = newCategory.trim()
    if (!val) return
    if (categories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    try {
      await updateSettings({ categories: [...categories, val] })
      setNewCategory('')
    } catch { /* handled */ }
  }

  const handleRemoveCategory = async (cat: string) => {
    try {
      await updateSettings({ categories: categories.filter((c) => c !== cat) })
    } catch { /* handled */ }
  }

  // ─── Accounts ───────────────────────────────────────────────────────────────

  const handleAddAccount = async () => {
    const val = newAccount.trim()
    if (!val) return
    if (accounts.some((a) => a.toLowerCase() === val.toLowerCase())) {
      toast.error('Account already exists')
      return
    }
    try {
      await updateSettings({ accounts: [...accounts, val] })
      setNewAccount('')
    } catch { /* handled */ }
  }

  const handleRemoveAccount = async (acc: string) => {
    try {
      await updateSettings({ accounts: accounts.filter((a) => a !== acc) })
    } catch { /* handled */ }
  }

  // ─── Data wipe ──────────────────────────────────────────────────────────────

  const handleWipe = async () => {
    setWiping(true)
    try {
      await api.delete('/api/state', { confirmation: 'DELETE ALL FINTRACK DATA' })
      setWipeOpen(false)
      setWipeInput('')
      toast.success('All data erased. Starting fresh.')
      useHabitStore.setState({ habits: [], done: {}, loaded: false })
      await loadState()
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wipe failed')
    } finally {
      setWiping(false)
    }
  }


  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your FinTrack workspace</p>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Recurring schedule timezone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Due dates are evaluated in this IANA timezone.</p>
          <Input
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Kolkata"
          />
          <Button onClick={async () => { try { await updateSettings({ timezone: timezone.trim() }); toast.success('Timezone saved') } catch { /* toast shown by the store */ } }}>Save timezone</Button>
        </CardContent>
      </Card>

      <ReminderSettings />

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
              placeholder="New category name…"
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 min-h-[44px]"
              aria-label="New category name"
            />
            <Button onClick={handleAddCategory}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm">
                {c}
                <button
                  onClick={() => handleRemoveCategory(c)}
                  className="-my-1 -mr-2 ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  aria-label={`Remove category ${c}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAccount())}
              placeholder="New account name…"
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 min-h-[44px]"
              aria-label="New account name"
            />
            <Button onClick={handleAddAccount}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm">
                {a}
                <button
                  onClick={() => handleRemoveAccount(a)}
                  className="-my-1 -mr-2 ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  aria-label={`Remove account ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Permanently delete all transactions, documents, rules, tags, budgets, goals, habits, and
            settings from FinTrack. Files stored outside FinTrack are not affected.
          </p>
          <Button variant="destructive" onClick={() => setWipeOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Erase all FinTrack data
          </Button>
        </CardContent>
      </Card>

      {/* Wipe confirmation dialog */}
      <Dialog open={wipeOpen} onOpenChange={(o) => { if (!o) { setWipeOpen(false); setWipeInput('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Erase all data
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <p>This will permanently delete:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                <li>All transactions</li>
                <li>All documents (R2 copies)</li>
                <li>All rules, tags, budgets, goals</li>
                <li>All habits and check-ins</li>
                <li>All settings</li>
              </ul>
              <p className="font-medium text-foreground">
                Files stored outside FINTRACK will remain untouched.
              </p>
              <p>Type <strong>DELETE</strong> to confirm:</p>
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={wipeInput}
            onChange={(e) => setWipeInput(e.target.value)}
            placeholder="Type DELETE"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Confirmation input"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setWipeOpen(false); setWipeInput('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={wipeInput !== 'DELETE'}
              loading={wiping}
              onClick={handleWipe}
            >
              Erase everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
