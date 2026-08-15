import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PageLoader } from '@/components/ui/Spinner'
import { lazy, Suspense } from 'react'

// Auth pages — eager loaded (small, needed before anything else)
import LoginPage from '@/pages/Auth/LoginPage'
import RegisterPage from '@/pages/Auth/RegisterPage'

// App pages — lazy loaded for better initial performance
const Dashboard      = lazy(() => import('@/pages/Dashboard/Dashboard'))
const Transactions   = lazy(() => import('@/pages/Transactions/Transactions'))
const Recurring      = lazy(() => import('@/pages/Recurring/Recurring'))
const Subscriptions  = lazy(() => import('@/pages/Subscriptions/Subscriptions'))
const Budgets        = lazy(() => import('@/pages/Budgets/Budgets'))
const Goals          = lazy(() => import('@/pages/Goals/Goals'))
const Documents      = lazy(() => import('@/pages/Documents/Documents'))
const Rules          = lazy(() => import('@/pages/Rules/Rules'))
const Settings       = lazy(() => import('@/pages/Settings/Settings'))

// ─── AppInitializer ──────────────────────────────────────────────────────────
// Runs after auth is confirmed. Loads app data and shows a spinner while doing so.

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { loadState, isLoading, error } = useAppStore()

  useEffect(() => {
    loadState()
  }, [loadState])

  if (isLoading) {
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
            <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="transactions"  element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
            <Route path="recurring"     element={<Suspense fallback={<PageLoader />}><Recurring /></Suspense>} />
            <Route path="subscriptions" element={<Suspense fallback={<PageLoader />}><Subscriptions /></Suspense>} />
            <Route path="budgets"       element={<Suspense fallback={<PageLoader />}><Budgets /></Suspense>} />
            <Route path="goals"         element={<Suspense fallback={<PageLoader />}><Goals /></Suspense>} />
            <Route path="documents"     element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />
            <Route path="rules"         element={<Suspense fallback={<PageLoader />}><Rules /></Suspense>} />
            <Route path="settings"      element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  )
}
