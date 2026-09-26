import { api } from './api'
import { getAuthToken } from '@/store/authStore'
import type { Document } from '@/types'

export const documentsService = {
  async upload(files: File[]): Promise<{ documents: Document[]; errors: string[] }> {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return api.upload('/api/documents', fd)
  },

  /** Fetch the original file (auth header required, so no plain link) as a Blob. */
  async download(id: string): Promise<Blob> {
    const token = getAuthToken()
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return res.blob()
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/documents/${id}`)
  },
}
