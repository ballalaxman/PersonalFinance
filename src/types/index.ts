// ─── Core Domain Types ────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income' | 'investment'
export type TransactionSource = 'manual' | 'recurring'

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  merchant: string
  category: string
  amount: number // positive magnitude
  type: TransactionType
  account: string
  tags: string[]
  receipt: boolean
  source: TransactionSource
  fingerprint: string
  createdAt: string
}

export type DocumentStatus = 'queued' | 'stored' | 'review'
export type DocumentSource = 'upload'

export interface Document {
  id: string
  filename: string
  mimeType: string
  size: number
  objectKey: string
  status: DocumentStatus
  source: DocumentSource
  createdAt: string
}

export interface Tag {
  name: string
  createdAt: string
}

export interface Rule {
  id: string
  whenText: string
  thenText: string
  enabled: boolean
  createdAt: string
}

// ─── Financial Settings ───────────────────────────────────────────────────────

export type DatePeriod =
  | 'this-month'
  | 'last-month'
  | 'last-quarter'
  | 'last-6-months'
  | 'this-year'
  | 'specific-month'   // month picker mode — paired with selectedMonth

export interface Budget {
  id: string
  category: string
  monthlyLimit: number
  active: boolean
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentSavedAmount: number
  dueDate?: string
  note?: string
}

export type RecurringCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

export type RecurringOccurrenceStatus = 'pending' | 'confirmed' | 'skipped' | 'postponed'

export interface RecurringSchedule {
  id: string
  name: string
  transactionType: TransactionType
  category: string
  amount: number
  account?: string
  cadence: RecurringCadence
  startDate: string
  dayOfMonth?: number
  nextDueDate: string
  endDate?: string
  active: boolean
  notifyDaysBefore: 0 | 1 | 3 | 7
  createdAt: string
  updatedAt: string
}

export interface RecurringOccurrence {
  id: string
  scheduleId: string
  scheduleName?: string
  dueDate: string
  expectedAmount: number
  status: RecurringOccurrenceStatus
  transactionId?: string
  postponedUntil?: string
  notificationSentAt?: string
  createdAt: string
  resolvedAt?: string
}

// ─── API State ────────────────────────────────────────────────────────────────

export interface AppSettings {
  categories: string[]
  accounts: string[]
  goals: Goal[]
  budgets: Budget[]
  selectedPeriod: DatePeriod
  selectedMonth: string
  timezone: string
  /** Local hour for bill reminders; null = off (server default 9) */
  reminderHour?: number | null
  /** Local hour for the habit nudge; null = off (server default 20) */
  habitReminderHour?: number | null
}

export interface AppState {
  transactions: Transaction[]
  tags: Tag[]
  rules: Rule[]
  settings: AppSettings
  documents: Document[]
  recurringSchedules: RecurringSchedule[]
  recurringOccurrences: RecurringOccurrence[]
  pendingRecurringCount: number
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly'
export type HabitColor = 'violet' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate'

export interface Habit {
  id: string
  name: string
  description: string
  color: HabitColor
  frequency: HabitFrequency
  /** Days per week that count as done; always 7 for daily habits. */
  targetPerWeek: number
  archived: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface HabitLog {
  habitId: string
  date: string // YYYY-MM-DD
}
