import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Wraps a route so only authenticated users can access it.
 * Unauthenticated users are redirected to /login, with the
 * attempted path saved in location.state.from so LoginPage
 * can redirect back after a successful sign-in.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
