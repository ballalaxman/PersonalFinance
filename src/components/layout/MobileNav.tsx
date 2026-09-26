import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV, isNavActive, useWorkspace } from './navigation'
import { cn } from '@/utils/cn'

export function MobileNav() {
  const location = useLocation()
  const workspace = useWorkspace()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card"
      aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex overflow-x-auto scrollbar-none">
        {NAV[workspace].map(({ to, label, icon: Icon }) => {
          const isActive = isNavActive(to, location.pathname)
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/' || to === '/habits'}
              className={cn(
                'flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 py-2 px-2 text-xs font-medium transition-colors flex-shrink-0',
                isActive ? 'text-violet-600' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn('h-5 w-5', isActive ? 'text-violet-600' : '')}
                aria-hidden="true"
              />
              <span className="leading-none">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
