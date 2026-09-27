import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Flame, Plus, Target, CalendarCheck, TrendingUp, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { useHabitStore } from '@/store/habitStore'
import { addDays, dailyCompletion, weekStart } from '@/utils/habits'
import { formatDate } from '@/utils/dates'
import { cn } from '@/utils/cn'
import type { HabitInput } from '@/services/habits'
import type { Habit } from '@/types'
import { HabitFormModal } from './HabitFormModal'
import { HABIT_COLORS, frequencyLabel } from './habitColors'
import { useHabits, type HabitWithStats } from './useHabits'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Starter ideas; the money-linked ones connect habits to the finance side.
const SUGGESTIONS: HabitInput[] = [
  { name: 'Exercise 30 minutes', description: '', color: 'emerald', frequency: 'weekly', targetPerWeek: 4 },
  { name: 'Read 20 pages', description: '', color: 'sky', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Log today\'s expenses', description: 'Add every spend in FinTrack before bed', color: 'violet', frequency: 'daily', targetPerWeek: 7 },
  { name: 'No-spend day', description: 'Nothing bought beyond essentials', color: 'amber', frequency: 'weekly', targetPerWeek: 2 },
  { name: 'Meditate 10 minutes', description: '', color: 'rose', frequency: 'daily', targetPerWeek: 7 },
]

export default function HabitDashboard() {
  const { items, today, loaded, error, reload } = useHabits()
  const { toggle, create } = useHabitStore()
  const [formOpen, setFormOpen] = useState(false)
  const active = useMemo(() => items.filter((i) => !i.habit.archived), [items])

  const summary = useMemo(() => {
    const due = active.filter((i) => i.stats.dueToday)
    const doneToday = due.filter((i) => i.stats.doneToday).length
    const avgRate = active.length ? Math.round(active.reduce((s, i) => s + i.stats.completionRate, 0) / active.length) : 0
    const top = [...active].sort((a, b) => b.stats.currentStreak - a.stats.currentStreak)[0]
    return { dueCount: due.length, doneToday, avgRate, top }
  }, [active])

  if (!loaded && error) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
        <span>Couldn't load your habits ({error}).</span>
        <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
      </div>
    )
  }
  if (!loaded) return <PageLoader />

  const addSuggestion = async (s: HabitInput) => {
    try { await create(s); toast.success(`Added "${s.name}"`) } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to add habit') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Habits</h1>
        <p className="text-sm text-muted-foreground">{formatDate(today, 'EEEE, d MMMM')}</p>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" aria-hidden="true" />}
          title="Start with one small habit"
          description="Pick a starter below or create your own. Check it off each day to build a streak."
          action={
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.name} type="button" onClick={() => addSuggestion(s)} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-violet-400 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600">
                  + {s.name}
                </button>
              ))}
              <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />Custom habit</Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat icon={<CalendarCheck className="h-5 w-5 text-violet-600" aria-hidden="true" />} bg="bg-violet-50" title="Today" value={`${summary.doneToday} / ${summary.dueCount}`} note={summary.dueCount === 0 ? 'Nothing due today' : summary.doneToday === summary.dueCount ? 'All done. Nice.' : `${summary.dueCount - summary.doneToday} left to do`} />
            <Stat icon={<Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />} bg="bg-orange-50" title="Top streak" value={summary.top ? streakText(summary.top) : '—'} note={summary.top?.stats.currentStreak ? summary.top.habit.name : 'Check in to start one'} />
            <Stat icon={<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />} bg="bg-emerald-50" title="30-day completion" value={`${summary.avgRate}%`} note="Average across active habits" />
            <Stat icon={<Target className="h-5 w-5 text-sky-600" aria-hidden="true" />} bg="bg-sky-50" title="Active habits" value={String(active.length)} note={<Link to="/habits/manage" className="text-violet-600 hover:underline">Manage habits</Link>} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Today's check-ins</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul role="list" className="divide-y divide-border">
                  {active.map((item) => <TodayRow key={item.habit.id} item={item} today={today} onToggle={() => toggle(item.habit.id, today)} />)}
                </ul>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Last 12 weeks</CardTitle></CardHeader>
              <CardContent><Heatmap items={active} today={today} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>This week</CardTitle></CardHeader>
            <CardContent className="p-0 pb-2 sm:overflow-x-auto">
              <WeekGrid items={active} today={today} onToggle={toggle} />
            </CardContent>
          </Card>
        </>
      )}

      <HabitFormModal open={formOpen} initial={null} onClose={() => setFormOpen(false)} />
    </div>
  )
}

function streakText({ habit, stats }: HabitWithStats): string {
  const unit = habit.frequency === 'daily' ? 'day' : 'week'
  return `${stats.currentStreak} ${unit}${stats.currentStreak === 1 ? '' : 's'}`
}

function Stat({ icon, bg, title, value, note }: { icon: React.ReactNode; bg: string; title: string; value: string; note: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>
          </div>
          <div className={cn('hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:flex', bg)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function TodayRow({ item, onToggle }: { item: HabitWithStats; today: string; onToggle: () => void }) {
  const { habit, stats } = item
  const colors = HABIT_COLORS[habit.color]
  const targetMet = habit.frequency === 'weekly' && !stats.dueToday
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={stats.doneToday}
        aria-label={`${stats.doneToday ? 'Undo' : 'Mark done'}: ${habit.name}`}
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2',
          stats.doneToday ? colors.done : 'border-border bg-background text-transparent hover:border-muted-foreground hover:text-muted-foreground'
        )}
      >
        <Check className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', stats.doneToday && 'text-muted-foreground line-through decoration-1')}>{habit.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {habit.frequency === 'weekly' ? `${stats.weekCount} of ${habit.targetPerWeek} this week${targetMet ? ' · target met' : ''}` : habit.description || frequencyLabel(habit.frequency, habit.targetPerWeek)}
        </p>
      </div>
      {stats.currentStreak > 0 && (
        <span className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-orange-600" title="Current streak">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          {streakText(item)}
        </span>
      )}
    </li>
  )
}

function WeekGrid({ items, today, onToggle }: { items: HabitWithStats[]; today: string; onToggle: (habitId: string, date: string) => void }) {
  const monday = weekStart(today)
  const days = WEEKDAYS.map((label, i) => ({ label, date: addDays(monday, i) }))
  return (
    <>
    {/* Phones: one block per habit with the seven days full width, no sideways scrolling */}
    <div className="sm:hidden">
      <div className="grid grid-cols-7 gap-1.5 px-4 pb-2 text-center text-[11px] text-muted-foreground">
        {days.map((d) => (
          <span key={d.date} className={cn(d.date === today && 'font-semibold text-violet-700')}>
            {d.label.slice(0, 1)}<span className="block tabular-nums">{d.date.slice(8)}</span>
          </span>
        ))}
      </div>
      <ul role="list" className="divide-y divide-border border-t border-border">
        {items.map(({ habit, done, stats }) => (
          <li key={habit.id} className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', HABIT_COLORS[habit.color].dot)} aria-hidden="true" />
                <span className="truncate">{habit.name}</span>
              </span>
              <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">{stats.weekCount}/{habit.frequency === 'weekly' ? habit.targetPerWeek : 7}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => (
                <DayCell key={d.date} habitName={habit.name} color={habit.color} date={d.date} isDone={done.has(d.date)} future={d.date > today} onToggle={() => onToggle(habit.id, d.date)} className="aspect-square w-full max-h-11" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>

    <table className="hidden w-full text-sm sm:table">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="px-5 py-2 text-left font-medium">Habit</th>
          {days.map((d) => (
            <th key={d.date} scope="col" className={cn('px-1 py-2 text-center font-medium', d.date === today && 'text-violet-700')}>
              {d.label}<span className="block text-[11px] font-normal tabular-nums">{d.date.slice(8)}</span>
            </th>
          ))}
          <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">Week</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ habit, done, stats }) => (
          <tr key={habit.id} className="border-t border-border">
            <th scope="row" className="max-w-[180px] truncate px-5 py-2 text-left font-medium">
              <span className={cn('mr-2 inline-block h-2 w-2 rounded-full align-middle', HABIT_COLORS[habit.color].dot)} aria-hidden="true" />
              {habit.name}
            </th>
            {days.map((d) => {
              return (
                <td key={d.date} className="px-1 py-2 text-center">
                  <DayCell habitName={habit.name} color={habit.color} date={d.date} isDone={done.has(d.date)} future={d.date > today} onToggle={() => onToggle(habit.id, d.date)} className="mx-auto h-8 w-8" />
                </td>
              )
            })}
            <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground sm:px-5">
              {habit.frequency === 'weekly' ? `${stats.weekCount}/${habit.targetPerWeek}` : `${stats.weekCount}/7`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  )
}

function DayCell({ habitName, color, date, isDone, future, onToggle, className }: {
  habitName: string; color: Habit['color']; date: string; isDone: boolean; future: boolean; onToggle: () => void; className?: string
}) {
  return (
    <button
      type="button"
      disabled={future}
      onClick={onToggle}
      aria-pressed={isDone}
      aria-label={`${habitName}, ${formatDate(date, 'EEEE d MMM')}: ${isDone ? 'done' : 'not done'}`}
      className={cn(
        'flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600',
        isDone ? HABIT_COLORS[color].done : 'border-border bg-background hover:bg-muted',
        future && 'cursor-not-allowed opacity-30 hover:bg-background',
        className
      )}
    >
      {isDone && <Check className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}

const HEAT = ['bg-muted', 'bg-violet-200', 'bg-violet-300', 'bg-violet-500', 'bg-violet-700']

function Heatmap({ items, today }: { items: HabitWithStats[]; today: string }) {
  const start = addDays(weekStart(today), -77)
  const days = Array.from({ length: 84 }, (_, i) => addDays(start, i))
  const cells = dailyCompletion(
    items.map((i) => ({ id: i.habit.id, createdDate: i.createdDate })),
    new Map(items.map((i) => [i.habit.id, i.done])),
    days,
  )
  const level = (ratio: number | null) => ratio === null || ratio === 0 ? 0 : ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : ratio < 1 ? 3 : 4
  const weeks = Array.from({ length: 12 }, (_, w) => cells.slice(w * 7, w * 7 + 7))

  return (
    <div className="space-y-3">
      {/* Column-major grid: weekday labels share rows with the cells, so they always line up */}
      <div className="grid grid-flow-col grid-rows-7 grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className="flex items-center pr-1 text-[10px] leading-none text-muted-foreground" aria-hidden="true">{i % 2 === 0 ? d.slice(0, 1) : ''}</span>
        ))}
        {weeks.flat().map((cell) => {
          const future = cell.date > today
          return (
            <div
              key={cell.date}
              title={future ? undefined : `${formatDate(cell.date, 'd MMM')}: ${cell.total ? `${cell.done} of ${cell.total} habits` : 'no habits yet'}`}
              className={cn('aspect-square w-full max-w-[18px] rounded-[3px]', future ? 'bg-transparent' : HEAT[level(cell.ratio)], cell.date === today && 'ring-1 ring-foreground/60')}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>Less</span>
        {HEAT.map((c) => <span key={c} className={cn('h-3 w-3 rounded-[3px]', c)} aria-hidden="true" />)}
        <span>More</span>
      </div>
    </div>
  )
}
