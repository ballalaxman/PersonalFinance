import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/utils/currency'
import { EmptyState } from '@/components/ui/EmptyState'
import { PieChart as PieIcon } from 'lucide-react'
import { CHART_COLORS } from '@/utils/constants'

interface SpendingChartProps {
  categories: { category: string; amount: number }[]
}

export function SpendingChart({ categories }: SpendingChartProps) {
  const data = useMemo(() => {
    const total = categories.reduce((sum, item) => sum + item.amount, 0)
    return categories
      .slice(0, 8)
      .map(({ category, amount }, i) => ({
        category, amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [categories])

  if (!data.length) {
    return (
      <EmptyState
        icon={<PieIcon className="h-6 w-6" aria-hidden="true" />}
        title="No expense data"
        description="Expense transactions will appear here grouped by category."
        className="border-0 py-8"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.category} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatCurrency(value)]}
            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220 13% 91%)', fontSize: '13px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <li key={d.category} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden="true"
            />
            <span className="truncate text-muted-foreground">{d.category}</span>
            <span className="ml-auto font-medium text-foreground">{d.percentage.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
