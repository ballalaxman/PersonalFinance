// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isInNoticeWindow, localHour, pendingHabits, planBillReminder, planHabitReminder } from './reminderPlan'

const today = '2026-09-27' // Sunday

describe('isInNoticeWindow', () => {
  it('opens N days before the due date and closes on the due date', () => {
    expect(isInNoticeWindow('2026-09-30', 3, today)).toBe(true)
    expect(isInNoticeWindow('2026-10-01', 3, today)).toBe(false)
    expect(isInNoticeWindow('2026-09-27', 3, today)).toBe(false) // due today: handled as a pending occurrence
    expect(isInNoticeWindow('2026-09-28', 0, today)).toBe(false) // "on due date" means no advance notice
  })
})

describe('planBillReminder', () => {
  it('returns nothing when there is nothing to say', () => {
    expect(planBillReminder([], [], today)).toBeNull()
  })

  it('names a single upcoming bill with relative timing and no amount', () => {
    expect(planBillReminder([{ id: 's1', name: 'Rent', dueDate: '2026-09-28' }], [], today))
      .toMatchObject({ title: 'Rent is due tomorrow', url: '/recurring', tag: 'bills-2026-09-27' })
  })

  it('summarises several items needing confirmation', () => {
    const msg = planBillReminder([], [
      { id: 'o1', name: 'Rent', dueDate: today }, { id: 'o2', name: 'SIP', dueDate: today },
      { id: 'o3', name: 'Gym', dueDate: today }, { id: 'o4', name: 'Internet', dueDate: today },
    ], today)
    expect(msg?.title).toBe('4 recurring items need confirmation')
    expect(msg?.body).toBe('Rent, SIP, Gym and 1 more')
  })

  it('combines due and upcoming items', () => {
    const msg = planBillReminder([{ id: 's1', name: 'Insurance', dueDate: '2026-10-02' }], [{ id: 'o1', name: 'Rent', dueDate: today }], today)
    expect(msg?.title).toBe('2 recurring reminders')
    expect(msg?.body).toBe('Needs confirmation: Rent. Coming up: Insurance (in 5 days).')
  })
})

describe('pendingHabits', () => {
  const habits = [
    { id: 'read', name: 'Read', frequency: 'daily' as const, targetPerWeek: 7 },
    { id: 'gym', name: 'Gym', frequency: 'weekly' as const, targetPerWeek: 3 },
    { id: 'nospend', name: 'No-spend day', frequency: 'weekly' as const, targetPerWeek: 2 },
  ]

  it('includes unchecked daily habits and weekly habits that must be done today', () => {
    // Sunday: last day of the week. Gym has 2 of 3, no-spend has 2 of 2.
    const done = new Map([
      ['gym', new Set(['2026-09-22', '2026-09-24'])],
      ['nospend', new Set(['2026-09-21', '2026-09-23'])],
    ])
    expect(pendingHabits(habits, done, today).map((h) => h.id)).toEqual(['read', 'gym'])
  })

  it('leaves weekly habits alone while there is still time in the week', () => {
    expect(pendingHabits(habits, new Map(), '2026-09-21').map((h) => h.id)).toEqual(['read']) // Monday
  })

  it('skips anything already done today', () => {
    const monday = '2026-09-21'
    expect(pendingHabits(habits, new Map([['read', new Set([monday])]]), monday)).toEqual([])
  })

  it('builds a short message', () => {
    expect(planHabitReminder([habits[0], habits[1]], today)).toEqual({ title: '2 habits left today', body: 'Read, Gym', url: '/habits', tag: 'habits-2026-09-27' })
    expect(planHabitReminder([], today)).toBeNull()
  })
})

describe('localHour', () => {
  it('converts to the user timezone', () => {
    expect(localHour(new Date('2026-09-27T14:45:00Z'), 'Asia/Kolkata')).toBe(20)
    expect(localHour(new Date('2026-09-27T23:30:00Z'), 'Asia/Kolkata')).toBe(5)
    expect(localHour(new Date('2026-09-27T14:45:00Z'), 'Not/AZone')).toBe(14)
  })
})
