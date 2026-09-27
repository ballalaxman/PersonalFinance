import React from 'react'
import { Link } from 'react-router-dom'
import { Wallet, CalendarCheck } from 'lucide-react'
import { cn } from '@/utils/cn'
import { WORKSPACE_HOME, useWorkspace, useWorkspaceMemory, type Workspace } from './navigation'

const TABS: { id: Workspace; label: string; icon: typeof Wallet }[] = [
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'habits', label: 'Habits', icon: CalendarCheck },
]

export function WorkspaceTabs() {
  const workspace = useWorkspace()
  const lastPath = useWorkspaceMemory((s) => s.lastPath)

  return (
    <nav aria-label="Switch dashboard" className="flex rounded-xl bg-muted p-1">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = workspace === id
        return (
          <Link
            key={id}
            // Tapping the active tab goes to that dashboard's home; the other tab resumes where you left it
            to={active ? WORKSPACE_HOME[id] : lastPath[id]}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 sm:px-3',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
