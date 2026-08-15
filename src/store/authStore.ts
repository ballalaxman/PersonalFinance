import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  createdAt: string
}

interface RegisterPayload {
  name: string
  email: string
  password: string
}

interface LoginPayload {
  email: string
  password: string
}

interface AuthStore {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  register: (payload: RegisterPayload) => Promise<void>
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
  /** Re-validate the stored token against the server. Call on app boot. */
  rehydrate: () => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      register: async ({ name, email, password }) => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })

        const data = await res.json() as { token?: string; user?: AuthUser; error?: string; details?: unknown }

        if (!res.ok) {
          throw new Error(data.error ?? 'Registration failed')
        }

        set({ token: data.token!, user: data.user!, isAuthenticated: true })
      },

      login: async ({ email, password }) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json() as { token?: string; user?: AuthUser; error?: string }

        if (!res.ok) {
          throw new Error(data.error ?? 'Login failed')
        }

        set({ token: data.token!, user: data.user!, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      rehydrate: async () => {
        const { token } = get()
        if (!token) return

        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          })

          if (!res.ok) {
            // Token expired or invalid — clear auth state
            set({ user: null, token: null, isAuthenticated: false })
            return
          }

          const data = await res.json() as { user?: AuthUser }
          if (data.user) {
            set({ user: data.user, isAuthenticated: true })
          }
        } catch {
          // Network error — keep existing state, don't log out
        }
      },
    }),
    {
      name: 'fintrack-auth',           // localStorage key
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
)

/** Standalone getter for use outside React (e.g. in api.ts). */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token
}
