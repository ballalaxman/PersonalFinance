import React from 'react'
import { useAppStore } from '@/store/appStore'
import { currentMonth } from '@/utils/dates'

export function PeriodSelector() {
  const { state, setMonth } = useAppStore()
  const month = state?.settings.selectedMonth ?? currentMonth()

  return (
    <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 w-44 rounded-lg border border-input bg-background px-3 text-sm" aria-label="Select month and year" />
  )
}
