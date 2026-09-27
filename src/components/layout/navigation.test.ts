import { beforeEach, describe, expect, it } from 'vitest'
import { WORKSPACE_HOME, isNavActive, useWorkspaceMemory, workspaceOfPath } from './navigation'

describe('workspaceOfPath', () => {
  it('maps habit routes to habits, shared pages to null, and everything else to finance', () => {
    expect(workspaceOfPath('/habits')).toBe('habits')
    expect(workspaceOfPath('/habits/manage')).toBe('habits')
    expect(workspaceOfPath('/habitsx')).toBe('finance')
    expect(workspaceOfPath('/budgets')).toBe('finance')
    expect(workspaceOfPath('/settings')).toBeNull()
  })
})

describe('workspace memory', () => {
  beforeEach(() => useWorkspaceMemory.setState({ current: 'finance', lastPath: { ...WORKSPACE_HOME } }))

  it('remembers the last page of each dashboard', () => {
    const { remember } = useWorkspaceMemory.getState()
    remember('/budgets')
    remember('/habits/manage')
    expect(useWorkspaceMemory.getState().lastPath).toEqual({ finance: '/budgets', habits: '/habits/manage' })
    expect(useWorkspaceMemory.getState().current).toBe('habits')
  })

  it('never records a shared page as a dashboard\'s last page', () => {
    // Habits → Settings → Finance → Habits used to land back on Settings with Finance highlighted
    const { remember, choose } = useWorkspaceMemory.getState()
    remember('/habits')
    remember('/settings')
    choose('finance')
    remember('/')
    expect(useWorkspaceMemory.getState().lastPath.habits).toBe('/habits')
    expect(useWorkspaceMemory.getState().current).toBe('finance')
  })

  it('keeps the chosen dashboard while on a shared page', () => {
    const { remember } = useWorkspaceMemory.getState()
    remember('/habits')
    remember('/settings')
    expect(useWorkspaceMemory.getState().current).toBe('habits')
  })
})

describe('isNavActive', () => {
  it('matches home routes exactly and sections by prefix', () => {
    expect(isNavActive('/', '/budgets')).toBe(false)
    expect(isNavActive('/habits', '/habits/manage')).toBe(false)
    expect(isNavActive('/habits/manage', '/habits/manage')).toBe(true)
    expect(isNavActive('/transactions', '/transactions')).toBe(true)
  })
})
