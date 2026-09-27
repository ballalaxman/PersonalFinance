import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useHabitStore } from '@/store/habitStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PageLoader } from '@/components/ui/Spinner'
import { lazy } from 'react'

// Auth pages — eager loaded (small, needed before anything else)
import LoginPage from '@/pages/Auth/LoginPage'
import RegisterPage from '@/pages/Auth/RegisterPage'

// App pages — code-split, but rendered directly once their code is in memory
type PageModule = { default: React.ComponentType }

/**
 * Like React.lazy, except that after the module has loaded (e.g. by the
 * background preload) it renders synchronously. React.lazy always suspends on
 * a component's first render, which flashes the loading spinner even when the
 * code is already downloaded.
 */
function lazyPage(loader: () => Promise<PageModule>) {
  let Loaded: React.ComponentType | null = null
  const load = () => loader().then((mod) => { Loaded = mod.default; return mod })
  const Lazy = lazy(load)
  const Page = () => (Loaded ? <Loaded /> : <Lazy />)
  return Object.assign(Page, { preload: load })
}

const Dashboard      = lazyPage(() => import('@/pages/Dashboard/Dashboard'))
const Transactions   = lazyPage(() => import('@/pages/Transactions/Transactions'))
const Recurring      = lazyPage(() => import('@/pages/Recurring/Recurring'))
const Budgets        = lazyPage(() => import('@/pages/Budgets/Budgets'))
const Goals          = lazyPage(() => import('@/pages/Goals/Goals'))
const Documents      = lazyPage(() => import('@/pages/Documents/Documents'))
const Rules          = lazyPage(() => import('@/pages/Rules/Rules'))
const Settings       = lazyPage(() => import('@/pages/Settings/Settings'))
const HabitDashboard = lazyPage(() => import('@/pages/Habits/HabitDashboard'))
const ManageHabits   = lazyPage(() => import('@/pages/Habits/ManageHabits'))
const pages = [Dashboard, Transactions, Recurring, Budgets, Goals, Documents, Rules, Settings, HabitDashboard, ManageHabits]

/**
 * Once the app is up, fetch every page's code and the habit data in the
 * background, so switching between Finance and Habits (or any page) is
 * instant instead of showing a spinner the first time.
 */
function preloadInBackground() {
  const run = () => {
    pages.forEach((page) => { page.preload().catch(() => {}) })
    const habits = useHabitStore.getState()
    if (!habits.loaded && !habits.isLoading) void habits.load()
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}

// ─── AppInitializer ──────────────────────────────────────────────────────────
// Runs after auth is confirmed. Loads app data and shows a spinner while doing so.

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { loadState, isLoading, error, state } = useAppStore()

  useEffect(() => {
    loadState()
  }, [loadState])

  const ready = Boolean(state) && !isLoading
  useEffect(() => {
    if (ready) preloadInBackground()
  }, [ready])

  if (isLoading || (!state && !error)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <PageLoader />
          <p className="text-sm text-muted-foreground">Loading FinTrack…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <h1 className="mb-2 text-lg font-semibold text-foreground">Unable to connect</h1>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => loadState()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ─── AuthBootstrap ───────────────────────────────────────────────────────────
// On app mount, re-validate the persisted token against the server.
// Shows nothing while validating (instant localStorage read, fast network check).

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const rehydrate = useAuthStore((s) => s.rehydrate)
  const [ready, setReady] = React.useState(false)

  useEffect(() => {
    rehydrate().finally(() => setReady(true))
  }, [rehydrate])

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <PageLoader />
      </div>
    )
  }

  return <>{children}</>
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected app shell — all data routes live inside */}
          <Route
            element={
              <ProtectedRoute>
                <AppInitializer>
                  <AppLayout />
                </AppInitializer>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="transactions"  element={<Transactions />} />
            <Route path="recurring"     element={<Recurring />} />
            <Route path="budgets"       element={<Budgets />} />
            <Route path="goals"         element={<Goals />} />
            <Route path="documents"     element={<Documents />} />
            <Route path="rules"         element={<Rules />} />
            <Route path="settings"      element={<Settings />} />
            <Route path="habits"        element={<HabitDashboard />} />
            <Route path="habits/manage" element={<ManageHabits />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  )
}
