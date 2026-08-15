import { api } from './api'
import type { AppSettings } from '@/types'

export const preferencesService = {
  async update(patch: Partial<AppSettings>): Promise<{ settings: AppSettings }> {
    return api.put('/api/preferences', patch)
  },
}
