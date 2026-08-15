import { api } from './api'
import type { Document } from '@/types'

export const documentsService = {
  async upload(files: File[]): Promise<{ documents: Document[]; errors: string[] }> {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return api.upload('/api/documents', fd)
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/documents/${id}`)
  },
}
