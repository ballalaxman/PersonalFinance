import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { NAV, isNavActive, useWorkspace, type NavItem } from './navigation'
import { cn } from '@/utils/cn'

// Five slots fit comfortably at 320px; anything beyond four items goes under "More".
const MAX_VISIBLE = 4

const itemClass = (active: boolean) => cn(
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 px-0.5 text-[10px] font-medium tracking-tight min-[400px]:text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600',
  active ? 'text-violet-600' : 'text-muted-foreground hover:text-foreground'
)

export function MobileNav() {
  const { pathname } = useLocation()
  const workspace = useWorkspace()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = NAV[workspace]
  const overflow = items.length > MAX_VISIBLE + 1
  const visible = overflow ? items.slice(0, MAX_VISIBLE) : items
  const hidden: NavItem[] = overflow ? items.slice(MAX_VISIBLE) : []
  const moreActive = hidden.some((i) => isNavActive(i.to, pathname))

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card"
      aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {visible.map(({ to, label, icon: Icon }) => {
          const active = isNavActive(to, pathname)
          return (
            <NavLink key={to} to={to} end={to === '/' || to === '/habits'} className={itemClass(active)} aria-current={active ? 'page' : undefined}>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate leading-none">{label}</span>
            </NavLink>
          )
        })}
        {overflow && (
          <button type="button" onClick={() => setMoreOpen(true)} className={itemClass(moreActive)} aria-haspopup="dialog" aria-expanded={moreOpen}>
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span className="leading-none">More</span>
          </button>
        )}
      </div>

      {overflow && (
        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>More</DialogTitle></DialogHeader>
            <ul className="grid grid-cols-2 gap-2" role="list">
              {hidden.map(({ to, label, icon: Icon }) => {
                const active = isNavActive(to, pathname)
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600',
                        active ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-border hover:bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      {label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </nav>
  )
}
