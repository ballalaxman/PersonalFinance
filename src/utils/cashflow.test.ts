import { describe, expect, it } from 'vitest'
import { computeCashFlow } from './cashflow'

describe('computeCashFlow', () => {
  it('follows the documented formulas', () => {
    expect(computeCashFlow({ income: 100000, expense: 60000, investment: 25000 })).toEqual({
      cashSurplus: 40000,
      unallocated: 15000,
      savingsRate: 40,
      investmentRate: 25,
    })
  })

  it('reports negative unallocated savings when investments exceed the surplus', () => {
    expect(computeCashFlow({ income: 50000, expense: 40000, investment: 20000 }).unallocated).toBe(-10000)
  })

  it('avoids division by zero without income', () => {
    expect(computeCashFlow({ income: 0, expense: 500, investment: 0 })).toEqual({
      cashSurplus: -500, unallocated: -500, savingsRate: 0, investmentRate: 0,
    })
  })
})
