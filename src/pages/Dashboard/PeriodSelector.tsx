import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  currentMonth,
  shiftMonth,
  formatMonthLabel,
  PERIOD_OPTIONS,
} from '@/utils/dates'
import type { DatePeriod } from '@/types'

export function PeriodSelector() {
  const { state, setPeriod, setMonth } = useAppStore()
  const period       = state?.settings.selectedPeriod  ?? 'this-month'
  const selectedMonth = state?.settings.selectedMonth  ?? currentMonth()

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as DatePeriod
    setPeriod(value)
    // When switching to specific-month, default to the current month
    if (value === 'specific-month') {
      setMonth(selectedMonth)
    }
  }

  const handlePrev = () => setMonth(shiftMonth(selectedMonth, -1))
  const handleNext = () => {
    const next = shiftMonth(selectedMonth, 1)
    // Don't allow navigating into the future beyond current month
    if (next <= currentMonth()) setMonth(next)
  }

  const isCurrentMonth = selectedMonth >= currentMonth()

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      {/* Period dropdown */}
      <select
        value={period}
        onChange={handlePeriodChange}
        className="h-10 rounded-lg border border-input bg-background px-3 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        aria-label="Select date period"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Month navigator — only shown when specific-month is selected */}
      {period === 'specific-month' && (
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <span className="min-w-[140px] text-center text-sm font-medium text-foreground">
            {formatMonthLabel(selectedMonth)}
          </span>

          <button
            onClick={handleNext}
            disabled={isCurrentMonth}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
