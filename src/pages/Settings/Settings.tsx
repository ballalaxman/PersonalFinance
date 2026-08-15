import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IndianRupee, Tag, LayoutGrid, CreditCard, RefreshCw,
  Trash2, ExternalLink, RotateCcw, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Badge } from '@/components/ui/Badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/Dialog'
import { useAppStore } from '@/store/appStore'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/dates'
import { api } from '@/services/api'

export default function Settings() {
  const { state, updateSettings, loadState } = useAppStore()
  const navigate = useNavigate()

  const settings = state?.settings
  const [assets, setAssets] = useState(String(settings?.assets ?? 0))
  const [liabilities, setLiabilities] = useState(String(settings?.liabilities ?? 0))
  const [savingNW, setSavingNW] = useState(false)

  const [newCategory, setNewCategory] = useState('')
  const [newAccount, setNewAccount] = useState('')

  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeInput, setWipeInput] = useState('')
  const [wiping, setWiping] = useState(false)

  const categories = settings?.categories ?? []
  const accounts = settings?.accounts ?? []
  const dismissed = settings?.dismissedPatterns ?? []

  // ─── Net Worth ──────────────────────────────────────────────────────────────

  const handleSaveNetWorth = async () => {
    const a = parseFloat(assets) || 0
    const l = parseFloat(liabilities) || 0
    setSavingNW(true)
    try {
      await updateSettings({ assets: a, liabilities: l, netWorthConfigured: true })
      toast.success('Net worth saved')
    } catch { /* handled */ } finally {
      setSavingNW(false)
    }
  }

  const liveNetWorth = (parseFloat(assets) || 0) - (parseFloat(liabilities) || 0)

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

  // ─── Detection ──────────────────────────────────────────────────────────────

  const handleRestoreIgnored = async () => {
    try {
      await updateSettings({ dismissedPatterns: [] })
      toast.success('Ignored suggestions restored')
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
      await loadState()
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wipe failed')
    } finally {
      setWiping(false)
    }
  }

  const driveSync = settings?.driveSync
  const driveFolder = settings?.driveFolder

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your FinTrack workspace</p>
      </div>

      {/* Net Worth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Net worth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your total assets and liabilities. Net worth is assets minus liabilities — it is
            not calculated from transaction cash flow.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Total assets"
              type="number"
              step="0.01"
              value={assets}
              onChange={(e) => setAssets(e.target.value)}
            />
            <Input
              label="Total liabilities"
              type="number"
              step="0.01"
              value={liabilities}
              onChange={(e) => setLiabilities(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-medium">Net worth preview</span>
            <span className={`text-lg font-bold ${liveNetWorth >= 0 ? 'text-foreground' : 'text-red-600'}`}>
              {formatCurrency(liveNetWorth)}
            </span>
          </div>
          <Button onClick={handleSaveNetWorth} loading={savingNW}>Save net worth</Button>
        </CardContent>
      </Card>

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
                  className="text-muted-foreground hover:text-red-500 ml-1"
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
                  className="text-muted-foreground hover:text-red-500 ml-1"
                  aria-label={`Remove account ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detection settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Automatic detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            FinTrack analyses your expense transactions to find recurring payment patterns. It uses
            merchant names, intervals, and amount variation to suggest recurring bills and
            subscriptions. Suggestions require explicit approval — they are never auto-confirmed.
          </p>
          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm">
              Ignored suggestions:{' '}
              <span className="font-semibold">{dismissed.length}</span>
            </span>
            {dismissed.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleRestoreIgnored}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Restore ignored
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Google Drive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Google Drive sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {driveFolder ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-medium">{driveFolder.name}</p>
                <Badge variant="info">Configured</Badge>
              </div>
              <a
                href={driveFolder.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                Open folder <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">Drive folder not configured yet.</p>
          )}

          {driveSync && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                { label: 'Last sync', value: driveSync.lastSyncedAt ? formatDate(driveSync.lastSyncedAt.split('T')[0]) : 'Never' },
                { label: 'Status', value: driveSync.status ?? 'idle' },
                { label: 'Imported', value: driveSync.imported },
                { label: 'Duplicates', value: driveSync.duplicates },
                { label: 'Files stored', value: driveSync.filesStored },
                { label: 'Needs review', value: driveSync.filesReview },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted p-2">
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-medium capitalize">{String(value)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            Add receipts, CSVs, statements, or invoices to your{' '}
            <strong>FinTrack Financial Inbox</strong> folder in Google Drive. The daily 8:00 AM
            automation will import new files automatically.
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
            Permanently delete all transactions, documents, rules, tags, budgets, goals, and
            settings from FinTrack. Your Google Drive files will not be deleted.
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
                <li>All settings</li>
              </ul>
              <p className="font-medium text-foreground">
                Your Google Drive files will remain untouched.
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
