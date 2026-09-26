/**
 * Decides what a reminder notification should say. Pure functions: the cron
 * handler gathers the data, these build the message.
 *
 * Notifications never include amounts or account names.
 */

export interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

export interface UpcomingBill { id: string; name: string; dueDate: string }
export interface DueBill { id: string; name: string; dueDate: string }

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function when(dueDate: string, today: string): string {
  const days = daysUntil(today, dueDate)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function list(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} and ${names.length - max} more` : shown
}

/** Is today inside the advance-notice window for a schedule's next due date? */
export function isInNoticeWindow(nextDueDate: string, notifyDaysBefore: number, today: string): boolean {
  return notifyDaysBefore > 0 && nextDueDate > today && addDays(nextDueDate, -notifyDaysBefore) <= today
}

export function planBillReminder(upcoming: UpcomingBill[], due: DueBill[], today: string): PushMessage | null {
  if (!upcoming.length && !due.length) return null
  const url = '/recurring'
  const tag = `bills-${today}`

  if (due.length && !upcoming.length) {
    return due.length === 1
      ? { title: `${due[0].name} needs confirmation`, body: 'It was due. Confirm, skip or postpone it in FinTrack.', url, tag }
      : { title: `${due.length} recurring items need confirmation`, body: list(due.map((d) => d.name)), url, tag }
  }

  if (upcoming.length && !due.length) {
    if (upcoming.length === 1) {
      const bill = upcoming[0]
      return { title: `${bill.name} is due ${when(bill.dueDate, today)}`, body: 'Open FinTrack to see what\'s coming up.', url, tag }
    }
    const sorted = [...upcoming].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    return { title: `${upcoming.length} recurring items coming up`, body: list(sorted.map((b) => `${b.name} (${when(b.dueDate, today)})`)), url, tag }
  }

  return {
    title: `${due.length + upcoming.length} recurring reminders`,
    body: `Needs confirmation: ${list(due.map((d) => d.name), 2)}. Coming up: ${list(upcoming.map((b) => `${b.name} (${when(b.dueDate, today)})`), 2)}.`,
    url,
    tag,
  }
}

export interface HabitForReminder { id: string; name: string; frequency: 'daily' | 'weekly'; targetPerWeek: number }

function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((day + 6) % 7))
}

/**
 * Habits still worth doing today: daily habits not yet checked, and weekly
 * habits that can only reach this week's target if done today.
 */
export function pendingHabits(habits: HabitForReminder[], doneDates: Map<string, Set<string>>, today: string): HabitForReminder[] {
  const monday = weekStart(today)
  const daysLeftInWeek = 7 - daysUntil(monday, today) // including today
  return habits.filter((habit) => {
    const done = doneDates.get(habit.id) ?? new Set<string>()
    if (done.has(today)) return false
    if (habit.frequency === 'daily') return true
    let weekCount = 0
    for (let i = 0; i < 7; i++) if (done.has(addDays(monday, i))) weekCount++
    const remaining = habit.targetPerWeek - weekCount
    return remaining > 0 && remaining >= daysLeftInWeek
  })
}

export function planHabitReminder(pending: HabitForReminder[], today: string): PushMessage | null {
  if (!pending.length) return null
  return {
    title: pending.length === 1 ? '1 habit left today' : `${pending.length} habits left today`,
    body: list(pending.map((h) => h.name)),
    url: '/habits',
    tag: `habits-${today}`,
  }
}

/** Local hour (0–23) in an IANA timezone; falls back to UTC for an invalid zone. */
export function localHour(at: Date, timezone: string): number {
  try {
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(at)
    return Number(hour)
  } catch {
    return at.getUTCHours()
  }
}
