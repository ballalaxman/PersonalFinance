// ─── Core Domain Types ────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income'
export type TransactionSource = 'manual' | 'csv' | 'document' | 'google-drive'

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
}

// ─── Import Types ─────────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  duplicates: number
  skipped: number
  needsReview: number
  errors: string[]
}

export interface CsvRow {
  date?: string
  merchant?: string
  description?: string
  amount?: string
  debit?: string
  credit?: string
  category?: string
  account?: string
  [key: string]: string | undefined
}

export interface CsvColumnMapping {
  date: string
  merchant: string
  amount?: string
  debit?: string
  credit?: string
  category?: string
  account?: string
}

// ─── Chart / UI Types ─────────────────────────────────────────────────────────

export interface CashFlowPoint {
  month: string
  income: number
  expenses: number
}

export interface CategorySpend {
  category: string
  amount: number
  percentage: number
  color: string
}
