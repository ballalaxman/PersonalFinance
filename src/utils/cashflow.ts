/**
 * Cash-flow figures for a period, as defined in APPLICATION_GUIDE.md:
 *
 *   Cash surplus        = Income − Expenses
 *   Unallocated savings = Cash surplus − Invested savings
 *   Savings rate        = Cash surplus / Income × 100
 *   Investment rate     = Invested savings / Income × 100
 *
 * Investments are allocations, not expenses, so they never reduce the surplus.
 */
export interface CashFlowTotals {
  income: number
  expense: number
  investment: number
}

export interface CashFlowSummary {
  cashSurplus: number
  unallocated: number
  savingsRate: number
  investmentRate: number
}

export function computeCashFlow({ income, expense, investment }: CashFlowTotals): CashFlowSummary {
  const cashSurplus = income - expense
  return {
    cashSurplus,
    unallocated: cashSurplus - investment,
    savingsRate: income > 0 ? (cashSurplus / income) * 100 : 0,
    investmentRate: income > 0 ? (investment / income) * 100 : 0,
  }
}
