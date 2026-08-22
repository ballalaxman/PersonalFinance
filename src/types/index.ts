// ─── Core Domain Types ────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income' | 'investment'
export type TransactionSource = 'manual' | 'csv' | 'document' | 'google-drive' | 'recurring'

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
export type DocumentSource = 'upload' | 'google-drive'

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
  | 'all-time'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'

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

export interface RecurringPayment {
  id: string
  name: string
  category: string
  amount: number
  cadence: RecurringCadence
  nextDate: string
  account?: string
  active: boolean
}

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

export interface Subscription {
  id: string
  name: string
  category: string
  amount: number
  cadence: RecurringCadence
  nextDate: string
  account?: string
  active: boolean
}

// ─── Detection Types ──────────────────────────────────────────────────────────

export type RecurringConfidence = 'high' | 'likely'

export interface RecurringSuggestion {
  key: string // normalized merchant + cadence
  merchant: string // normalized display name
  category: string
  cadence: RecurringCadence
  averageAmount: number
  monthlyEquivalent: number
  occurrenceCount: number
  confidence: RecurringConfidence
  nextExpectedDate: string
  isSubscription: boolean
  transactionIds: string[]
}

// ─── API State ────────────────────────────────────────────────────────────────

export interface AppSettings {
  categories: string[]
  accounts: string[]
  goals: Goal[]
  budgets: Budget[]
  subscriptions: Subscription[]
  recurring: RecurringPayment[]
  dismissedPatterns: string[]
  assets: number
  liabilities: number
  netWorthConfigured: boolean
  selectedPeriod: DatePeriod
  selectedMonth: string
  timezone: string
  driveFolder?: DriveFolderMeta
  driveSync?: DriveSyncMeta
  freshStart?: boolean
  driveResetAt?: string
}

export interface DriveFolderMeta {
  id: string
  name: string
  url: string
}

export interface DriveSyncMeta {
  lastSyncedAt?: string
  status?: 'complete' | 'partial' | 'error' | 'idle'
  imported: number
  duplicates: number
  filesStored: number
  filesReview: number
  errors: string[]
  processedFileIds: string[]
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

// ─── Import Types ─────────────────────────────────────────────────────────────

// ─── Chart / UI Types ─────────────────────────────────────────────────────────

export interface CashFlowPoint {
  month: string
  income: number
  expenses: number
  investments: number
}

export interface CategorySpend {
  category: string
  amount: number
  percentage: number
  color: string
}
