import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { create } from 'zustand'
import { useAuthStore } from '@/store/authStore'
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

/** Pages shown in both dashboards; they belong to whichever one the user came from. */
const SHARED_PREFIXES = ['/settings']

/** The dashboard a path belongs to, or null for a shared page such as Settings. */
export function workspaceOfPath(pathname: string): Workspace | null {
  if (SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null
  if (pathname === '/habits' || pathname.startsWith('/habits/')) return 'habits'
  return 'finance'
}

interface WorkspaceMemory {
  /** Dashboard to show on shared pages */
  current: Workspace
  /** Last page opened in each dashboard (never a shared page), so switching back returns there */
  lastPath: Record<Workspace, string>
  remember: (pathname: string) => void
  choose: (workspace: Workspace) => void
}

export const useWorkspaceMemory = create<WorkspaceMemory>((set, get) => ({
  current: 'finance',
  lastPath: { ...WORKSPACE_HOME },
  remember: (pathname) => {
    const ws = workspaceOfPath(pathname)
    if (!ws) return
    const { current, lastPath } = get()
    if (current !== ws || lastPath[ws] !== pathname) set({ current: ws, lastPath: { ...lastPath, [ws]: pathname } })
  },
  choose: (workspace) => set({ current: workspace }),
}))

// A different account signing in starts from the Finance home, not the last user's page
useAuthStore.subscribe((next, prev) => {
  if (next.user?.id !== prev.user?.id) useWorkspaceMemory.setState({ current: 'finance', lastPath: { ...WORKSPACE_HOME } })
})

/** Active dashboard: decided by the URL when it's unambiguous, otherwise by where the user came from. */
export function useWorkspace(): Workspace {
  const { pathname } = useLocation()
  const current = useWorkspaceMemory((s) => s.current)
  return workspaceOfPath(pathname) ?? current
}

/** Mount once in the app shell: records dashboard pages as the user moves around. */
export function useRememberWorkspacePath(): void {
  const { pathname } = useLocation()
  const remember = useWorkspaceMemory((s) => s.remember)
  useEffect(() => { remember(pathname) }, [pathname, remember])
}

export function isNavActive(to: string, pathname: string): boolean {
  if (to === '/' || to === '/habits') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}
