import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { PERIOD_OPTIONS } from '@/utils/dates'
import type { DatePeriod } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

export function PeriodSelector() {
  const { state, setPeriod } = useAppStore()
  const period = state?.settings.selectedPeriod ?? 'all-time'

  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as DatePeriod)}>
      <SelectTrigger className="w-44" aria-label="Select date period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
