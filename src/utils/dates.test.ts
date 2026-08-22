import { describe, expect, it } from 'vitest'
import { currentMonth, monthDateRange } from './dates'

describe('monthDateRange', () => {
  it('returns the complete selected month', () => {
    expect(monthDateRange('2026-07')).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' })
  })

  it('handles leap years', () => {
    expect(monthDateRange('2024-02').endDate).toBe('2024-02-29')
    expect(monthDateRange('2025-02').endDate).toBe('2025-02-28')
  })

  it('rejects invalid months', () => {
    expect(() => monthDateRange('2026-13')).toThrow('Invalid month')
  })

  it('uses the current local month as the default', () => {
    const now = new Date()
    expect(currentMonth()).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  })
})
