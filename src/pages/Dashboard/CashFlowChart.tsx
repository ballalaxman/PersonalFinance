import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO, startOfMonth, isValid } from 'date-fns'
import type { Transaction } from '@/types'
import { formatCurrency } from '@/utils/currency'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrendingUp } from 'lucide-react'

interface CashFlowChartProps {
  transactions: Transaction[]
}

export function CashFlowChart({ transactions }: CashFlowChartProps) {
  const data = useMemo(() => {
    if (!transactions.length) return []

    // Group by month (last 7 months max)
    const monthMap: Record<string, { income: number; expenses: number }> = {}

    for (const t of transactions) {
      const d = parseISO(t.date)
      if (!isValid(d)) continue
      const key = format(startOfMonth(d), 'yyyy-MM')
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 }
      if (t.type === 'income') monthMap[key].income += t.amount
      else monthMap[key].expenses += t.amount
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([key, vals]) => ({
        month: format(parseISO(`${key}-01`), 'MMM yy'),
        income: Math.round(vals.income * 100) / 100,
        expenses: Math.round(vals.expenses * 100) / 100,
      }))
  }, [transactions])

  if (!data.length) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
        title="No cash flow data"
        description="Import or add transactions to see cash flow."
        className="border-0 py-8"
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6558D3" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6558D3" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === 'income' ? 'Income' : 'Expenses',
          ]}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid hsl(220 13% 91%)',
            fontSize: '13px',
          }}
        />
        <Legend
          formatter={(value) => (value === 'income' ? 'Income' : 'Expenses')}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#incomeGrad)"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#6558D3"
          strokeWidth={2}
          fill="url(#expensesGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
