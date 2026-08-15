import { create } from 'zustand'
import { api } from '@/services/api'
import { preferencesService } from '@/services/preferences'
import type { AppState, AppSettings, DatePeriod, Transaction, Tag, Rule, Document } from '@/types'
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from '@/utils/constants'
import { toast } from 'sonner'

interface AppStore {
  // State
  state: AppState | null
  isLoading: boolean
  error: string | null
  isSyncing: boolean

  // Actions
  loadState: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  setPeriod: (period: DatePeriod) => Promise<void>
  syncDrive: () => Promise<void>
  addTransaction: (t: Transaction) => void
  updateTransaction: (t: Transaction) => void
  removeTransaction: (id: string) => void
  addDocument: (d: Document) => void
  removeDocument: (id: string) => void
  addTag: (tag: Tag) => void
  removeTag: (name: string) => void
  addRule: (rule: Rule) => void
  updateRule: (rule: Rule) => void
  removeRule: (id: string) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  categories: [...DEFAULT_CATEGORIES],
  accounts: [...DEFAULT_ACCOUNTS],
  goals: [],
  budgets: [],
  subscriptions: [],
  recurring: [],
  dismissedPatterns: [],
  assets: 0,
  liabilities: 0,
  netWorthConfigured: false,
  selectedPeriod: 'all-time',
}

export const useAppStore = create<AppStore>((set, get) => ({
  state: null,
  isLoading: false,
  error: null,
  isSyncing: false,

  loadState: async () => {
    set({ isLoading: true, error: null })
    try {
      const appState = await api.get<AppState>('/api/state')
      // Merge with defaults to ensure categories/accounts exist
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...appState.settings,
        categories: appState.settings?.categories?.length
          ? appState.settings.categories
          : DEFAULT_SETTINGS.categories,
        accounts: appState.settings?.accounts?.length
          ? appState.settings.accounts
          : DEFAULT_SETTINGS.accounts,
      }
      set({ state: { ...appState, settings }, isLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data'
      set({ error: msg, isLoading: false })
    }
  },

  updateSettings: async (patch) => {
    const { state } = get()
    if (!state) return

    const optimistic: AppSettings = { ...state.settings, ...patch }
    set({ state: { ...state, settings: optimistic } })

    try {
      const { settings } = await preferencesService.update(patch)
      set({ state: { ...get().state!, settings } })
    } catch (err) {
      // Rollback
      set({ state: { ...get().state!, settings: state.settings } })
      toast.error('Failed to save settings')
      throw err
    }
  },

  setPeriod: async (period) => {
    const { state } = get()
    if (!state) return
    const prev = state.settings.selectedPeriod
    // Optimistic
    set({ state: { ...state, settings: { ...state.settings, selectedPeriod: period } } })
    try {
      await preferencesService.update({ selectedPeriod: period })
    } catch {
      // Rollback
      set({
        state: {
          ...get().state!,
          settings: { ...get().state!.settings, selectedPeriod: prev },
        },
      })
      toast.error('Failed to save period selection')
    }
  },

  syncDrive: async () => {
    set({ isSyncing: true })
    try {
      await api.post('/api/drive-sync/trigger', {})
      toast.success('Drive sync triggered')
      await get().loadState()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Drive sync failed'
      toast.error(msg)
    } finally {
      set({ isSyncing: false })
    }
  },

  addTransaction: (t) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, transactions: [t, ...state.transactions] } })
  },

  updateTransaction: (t) => {
    const { state } = get()
    if (!state) return
    set({
      state: {
        ...state,
        transactions: state.transactions.map((x) => (x.id === t.id ? t : x)),
      },
    })
  },

  removeTransaction: (id) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, transactions: state.transactions.filter((t) => t.id !== id) } })
  },

  addDocument: (d) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, documents: [d, ...state.documents] } })
  },

  removeDocument: (id) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, documents: state.documents.filter((d) => d.id !== id) } })
  },

  addTag: (tag) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, tags: [...state.tags, tag] } })
  },

  removeTag: (name) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, tags: state.tags.filter((t) => t.name !== name) } })
  },

  addRule: (rule) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, rules: [rule, ...state.rules] } })
  },

  updateRule: (rule) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, rules: state.rules.map((r) => (r.id === rule.id ? rule : r)) } })
  },

  removeRule: (id) => {
    const { state } = get()
    if (!state) return
    set({ state: { ...state, rules: state.rules.filter((r) => r.id !== id) } })
  },
}))
