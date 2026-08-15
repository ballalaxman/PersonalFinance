import React, { useState } from 'react'
import { PiggyBank, RefreshCw, Upload, Plus, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { AddEntryModal } from '@/components/modals/AddEntryModal'
import { ImportModal } from '@/components/modals/ImportModal'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'

export function TopBar() {
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const { syncDrive, isSyncing } = useAppStore()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border bg-card px-4 lg:px-6">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">FinTrack</span>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={syncDrive}
            loading={isSyncing}
            aria-label="Sync Google Drive"
            title="Drive sync"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Drive sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            aria-label="Import data"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Import</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setAddEntryOpen(true)}
            aria-label="Add entry"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add entry</span>
          </Button>

          {/* User + logout */}
          <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
            {user && (
              <span className="hidden text-xs text-muted-foreground md:block max-w-[120px] truncate" title={user.email}>
                {user.name || user.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <AddEntryModal open={addEntryOpen} onClose={() => setAddEntryOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
