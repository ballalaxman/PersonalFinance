import { describe, expect, it } from 'vitest'
import { isNavActive, workspaceForPath } from './navigation'

describe('workspaceForPath', () => {
  it('maps habit routes to the habits dashboard and everything else to finance', () => {
    expect(workspaceForPath('/habits')).toBe('habits')
    expect(workspaceForPath('/habits/manage')).toBe('habits')
    expect(workspaceForPath('/habitsx')).toBe('finance')
    expect(workspaceForPath('/budgets', 'habits')).toBe('finance')
  })

  it('keeps shared Settings in the workspace the user came from', () => {
    expect(workspaceForPath('/settings', 'habits')).toBe('habits')
    expect(workspaceForPath('/settings', 'finance')).toBe('finance')
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
