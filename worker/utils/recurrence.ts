export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function nextRecurringDate(current: string, cadence: Cadence, preferredDay?: number | null): string {
  const date = parseDate(current)
  if (cadence === 'weekly' || cadence === 'biweekly') {
    date.setUTCDate(date.getUTCDate() + (cadence === 'weekly' ? 7 : 14))
    return isoDate(date)
  }

  const months = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12
  const targetMonthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + months
  const year = Math.floor(targetMonthIndex / 12)
  const month = targetMonthIndex % 12
  const day = Math.min(preferredDay ?? date.getUTCDate(), daysInMonth(year, month))
  return isoDate(new Date(Date.UTC(year, month, day)))
}

export function localDateForTimezone(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const value = (type: string) => parts.find((p) => p.type === type)?.value
    return `${value('year')}-${value('month')}-${value('day')}`
  } catch {
    return now.toISOString().slice(0, 10)
  }
}
