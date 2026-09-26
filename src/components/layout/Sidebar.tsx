import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV, isNavActive, useWorkspace } from './navigation'
import { PiggyBank } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Sidebar() {
  const location = useLocation()
  const workspace = useWorkspace()

  return (
    <aside className="hidden lg:flex h-full w-[238px] flex-shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-[76px] items-center px-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">FinTrack</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label={workspace === 'habits' ? 'Habits navigation' : 'Finance navigation'}>
        <ul className="space-y-0.5" role="list">
          {NAV[workspace].map(({ to, label, icon: Icon }) => {
            const isActive = isNavActive(to, location.pathname)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/' || to === '/habits'}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-violet-600' : '')}
                    aria-hidden="true"
                  />
                  {label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Private · Owner only</p>
      </div>
    </aside>
  )
}
