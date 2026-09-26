import type { HabitColor } from '@/types'

// Full class strings so Tailwind's JIT can see them.
export const HABIT_COLORS: Record<HabitColor, { label: string; dot: string; done: string; soft: string }> = {
  violet:  { label: 'Violet',  dot: 'bg-violet-500',  done: 'bg-violet-600 border-violet-600 text-white',   soft: 'bg-violet-100 text-violet-700' },
  emerald: { label: 'Green',   dot: 'bg-emerald-500', done: 'bg-emerald-600 border-emerald-600 text-white', soft: 'bg-emerald-100 text-emerald-700' },
  sky:     { label: 'Blue',    dot: 'bg-sky-500',     done: 'bg-sky-600 border-sky-600 text-white',         soft: 'bg-sky-100 text-sky-700' },
  amber:   { label: 'Amber',   dot: 'bg-amber-500',   done: 'bg-amber-500 border-amber-500 text-white',     soft: 'bg-amber-100 text-amber-800' },
  rose:    { label: 'Rose',    dot: 'bg-rose-500',    done: 'bg-rose-600 border-rose-600 text-white',       soft: 'bg-rose-100 text-rose-700' },
  slate:   { label: 'Slate',   dot: 'bg-slate-500',   done: 'bg-slate-700 border-slate-700 text-white',     soft: 'bg-slate-100 text-slate-700' },
}

export function frequencyLabel(frequency: 'daily' | 'weekly', targetPerWeek: number): string {
  return frequency === 'daily' ? 'Every day' : `${targetPerWeek}× per week`
}
