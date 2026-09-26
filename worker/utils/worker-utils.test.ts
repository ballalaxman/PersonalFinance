// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyRuleSet } from './rules'
import { isCalendarDate, isValidTimezone } from './validation'
import { nextRecurringDate } from './recurrence'
import { signJWT, verifyJWT } from './crypto'
import { isRegistrationAllowed } from '../routes/auth'

describe('applyRuleSet', () => {
  it('applies category rules case-insensitively, later rules winning', () => {
    const rules = [
      { whenText: 'amazon', thenText: 'Shopping' },
      { whenText: 'Amazon Prime', thenText: 'Subscriptions' },
    ]
    expect(applyRuleSet(rules, 'AMAZON PRIME VIDEO', 'Needs review', []).category).toBe('Subscriptions')
    expect(applyRuleSet(rules, 'Amazon Marketplace', 'Needs review', []).category).toBe('Shopping')
  })

  it('adds tags for tag: rules without changing the category', () => {
    const result = applyRuleSet([{ whenText: 'netflix', thenText: 'tag:Streaming' }], 'Netflix', 'Entertainment', ['family'])
    expect(result).toEqual({ category: 'Entertainment', tags: ['family', 'streaming'] })
  })

  it('leaves non-matching merchants untouched', () => {
    expect(applyRuleSet([{ whenText: 'uber', thenText: 'Transportation' }], 'Swiggy', 'Dining', [])).toEqual({ category: 'Dining', tags: [] })
  })
})

describe('isCalendarDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-02-31')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('26-01-01')).toBe(false)
  })
})

describe('isValidTimezone', () => {
  it('validates IANA names', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
  })
})

describe('nextRecurringDate', () => {
  it('clamps monthly schedules to the month end and restores the preferred day', () => {
    expect(nextRecurringDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(nextRecurringDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
  })

  it('handles weekly, quarterly and annual cadences', () => {
    expect(nextRecurringDate('2026-12-28', 'weekly')).toBe('2027-01-04')
    expect(nextRecurringDate('2026-11-15', 'quarterly', 15)).toBe('2027-02-15')
    expect(nextRecurringDate('2024-02-29', 'annual', 29)).toBe('2025-02-28')
  })
})

describe('verifyJWT', () => {
  const secret = 'test-secret'

  it('round-trips a signed token', async () => {
    const token = await signJWT({ sub: 'u1', email: 'a@b.c', name: 'A' }, secret)
    expect((await verifyJWT(token, secret))?.sub).toBe('u1')
  })

  it('returns null for malformed or tampered tokens instead of throwing', async () => {
    expect(await verifyJWT('a.b.%%%', secret)).toBeNull()
    const token = await signJWT({ sub: 'u1', email: 'a@b.c', name: 'A' }, secret)
    expect(await verifyJWT(token, 'other-secret')).toBeNull()
  })

  it('rejects expired tokens', async () => {
    const token = await signJWT({ sub: 'u1', email: 'a@b.c', name: 'A' }, secret, -10)
    expect(await verifyJWT(token, secret)).toBeNull()
  })
})

describe('isRegistrationAllowed', () => {
  it('is open when no allowlist is configured', () => {
    expect(isRegistrationAllowed('anyone@example.com', undefined)).toBe(true)
    expect(isRegistrationAllowed('anyone@example.com', '  ')).toBe(true)
  })

  it('only admits listed emails, ignoring case and spacing', () => {
    const list = 'me@example.com, Partner@Example.com'
    expect(isRegistrationAllowed('partner@example.com', list)).toBe(true)
    expect(isRegistrationAllowed('stranger@example.com', list)).toBe(false)
  })
})
