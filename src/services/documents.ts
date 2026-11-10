import { api } from './api'
import { getAuthToken } from '@/store/authStore'
import type { Document } from '@/types'

export const documentsService = {
  /** With `transactionId`, the first file is attached to that transaction as its receipt. */
  async upload(files: File[], transactionId?: string): Promise<{ documents: Document[]; errors: string[] }> {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    if (transactionId) fd.append('transactionId', transactionId)
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

  /** Open a stored file in a new tab. Call straight from a click so popup blockers allow it. */
  async open(id: string): Promise<void> {
    const tab = window.open('', '_blank')
    try {
      const blob = await documentsService.download(id)
      const url = URL.createObjectURL(blob)
      if (tab) tab.location.href = url
      else window.location.assign(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      tab?.close()
      throw err
    }
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/documents/${id}`)
  },
}
