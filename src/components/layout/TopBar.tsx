import React, { useState } from 'react'
import { PiggyBank, Plus, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { AddEntryModal } from '@/components/modals/AddEntryModal'
import { HabitFormModal } from '@/pages/Habits/HabitFormModal'
import { useAuthStore } from '@/store/authStore'
import { WorkspaceTabs } from './WorkspaceTabs'
import { useWorkspace } from './navigation'

export function TopBar() {
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [habitFormOpen, setHabitFormOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const workspace = useWorkspace()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // The primary action follows the active dashboard
  const primary = workspace === 'habits'
    ? { label: 'New habit', onClick: () => setHabitFormOpen(true) }
    : { label: 'Add entry', onClick: () => setAddEntryOpen(true) }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between gap-2 border-b border-border bg-card px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile logo */}
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white lg:hidden">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
          </div>
          <WorkspaceTabs />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={primary.onClick} aria-label={primary.label}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{primary.label}</span>
          </Button>

          {/* User + logout */}
          <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
            {user && (
              <span className="hidden text-xs text-muted-foreground md:block max-w-[120px] truncate" title={user.email}>
                {user.name || user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <AddEntryModal open={addEntryOpen} onClose={() => setAddEntryOpen(false)} />
      <HabitFormModal open={habitFormOpen} initial={null} onClose={() => setHabitFormOpen(false)} />
    </>
  )
}
