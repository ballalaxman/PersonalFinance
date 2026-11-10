/**
 * Base API client — all requests go through here.
 * The Vite dev server proxies /api → http://localhost:8787.
 * Automatically injects the Bearer token from authStore when present.
 */

import { getAuthToken } from '@/store/authStore'

const BASE = ''

/** A failed request: keeps the HTTP status and the server's JSON body so callers can react to specific cases. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
  }
}

/** True when the server refused a transaction because a look-alike already exists. */
export function isDuplicateError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.body.duplicate === true
}

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
    let body: Record<string, unknown> = {}
    try {
      body = await res.json() as Record<string, unknown>
      if (typeof body.error === 'string') message = body.error
      else if (typeof body.message === 'string') message = body.message
    } catch {
      // ignore parse error
    }
    throw new ApiError(message, res.status, body)
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
