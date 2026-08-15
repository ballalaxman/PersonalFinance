import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  RefreshCw,
  CreditCard,
  PiggyBank,
  Target,
  FileText,
  BookOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/recurring', label: 'Recurring', icon: RefreshCw },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rules', label: 'Rules', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const location = useLocation()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card"
      aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={cn(
                'flex min-w-[72px] flex-col items-center justify-center gap-1 py-2 px-2 text-xs font-medium transition-colors flex-shrink-0',
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
