/**
 * Base API client — all requests go through here.
 * The Vite dev server proxies /api → http://localhost:8787.
 * Automatically injects the Bearer token from authStore when present.
 */

import { getAuthToken } from '@/store/authStore'

const BASE = ''

async function request<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<T> {
  const token = getAuthToken()

  // Spread the incoming headers safely — options.headers may be a plain object or undefined
  const extraHeaders = options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)
    ? (options.headers as Record<string, string>)
    : {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    // If the server returns 401, clear auth state so the app redirects to login
    if (res.status === 401) {
      // Lazy import to avoid circular dependency at module load time
      const { useAuthStore } = await import('@/store/authStore')
      useAuthStore.getState().logout()
    }

    let message = `HTTP ${res.status}`
    try {
      const body = await res.json() as { error?: string; message?: string }
      message = body.error ?? body.message ?? message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  delete<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /**
   * Multipart form upload — do not set Content-Type; browser handles boundary.
   */
  upload<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: {}, // clears Content-Type so browser sets multipart boundary
      body: formData,
    })
  },
}
