import { useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, RefreshCw, PiggyBank, Target, FileText, BookOpen, Settings,
  CalendarCheck, ListChecks, type LucideIcon,
} from 'lucide-react'

export type Workspace = 'finance' | 'habits'

export interface NavItem { to: string; label: string; icon: LucideIcon }

export const NAV: Record<Workspace, NavItem[]> = {
  finance: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transactions', icon: Receipt },
    { to: '/recurring', label: 'Recurring', icon: RefreshCw },
    { to: '/budgets', label: 'Budgets', icon: PiggyBank },
    { to: '/goals', label: 'Goals', icon: Target },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/rules', label: 'Rules', icon: BookOpen },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  habits: [
    { to: '/habits', label: 'Today', icon: CalendarCheck },
    { to: '/habits/manage', label: 'Manage', icon: ListChecks },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
}

export const WORKSPACE_HOME: Record<Workspace, string> = { finance: '/', habits: '/habits' }

/** Settings is shared; it stays in whichever workspace the user came from. */
export function workspaceForPath(pathname: string, previous: Workspace = 'finance'): Workspace {
  if (pathname === '/habits' || pathname.startsWith('/habits/')) return 'habits'
  if (pathname.startsWith('/settings')) return previous
  return 'finance'
}

let lastWorkspace: Workspace = 'finance'

export function useWorkspace(): Workspace {
  const { pathname } = useLocation()
  lastWorkspace = workspaceForPath(pathname, lastWorkspace)
  return lastWorkspace
}

export function isNavActive(to: string, pathname: string): boolean {
  if (to === '/' || to === '/habits') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}
