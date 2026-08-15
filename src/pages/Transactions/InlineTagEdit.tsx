import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import { normalizeTags } from '@/utils/fingerprint'
import type { Transaction } from '@/types'
import { api } from '@/services/api'

interface InlineTagEditProps {
  transaction: Transaction
}

export function InlineTagEdit({ transaction }: InlineTagEditProps) {
  const { updateTransaction, state, addTag } = useAppStore()
  const [open, setOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [localTags, setLocalTags] = useState<string[]>(transaction.tags)

  const allTags = state?.tags.map((t) => t.name) ?? []

  const handleOpen = () => {
    setLocalTags([...transaction.tags])
    setOpen(true)
  }

  const removeTagInline = async (tag: string) => {
    const newTags = transaction.tags.filter((t) => t !== tag)
    try {
      const { transaction: updated } = await transactionsService.update(transaction.id, {
        tags: newTags,
      })
      updateTransaction(updated)
    } catch {
      toast.error('Failed to remove tag')
    }
  }

  const addLocalTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || localTags.includes(tag)) return
    setLocalTags(normalizeTags([...localTags, tag]))
    setTagInput('')
  }

  const removeLocalTag = (tag: string) => {
    setLocalTags(localTags.filter((t) => t !== tag))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { transaction: updated } = await transactionsService.update(transaction.id, {
        tags: localTags,
      })
      // Also ensure any new tags exist in global tags table
      for (const tag of localTags) {
        if (!allTags.includes(tag)) {
          try {
            const result = await api.post<{ tag: { name: string; createdAt: string } }>(
              '/api/tags',
              { name: tag }
            )
            addTag(result.tag)
          } catch {
            // Tag may already exist
          }
        }
      }
      updateTransaction(updated)
      setOpen(false)
    } catch {
      toast.error('Failed to update tags')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {transaction.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
          >
            {tag}
            <button
              onClick={() => removeTagInline(tag)}
              className="hover:text-violet-900 leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <button
          onClick={handleOpen}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-colors"
          aria-label="Add tag"
          title="Add tag"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current tags */}
            <div className="flex flex-wrap gap-1.5">
              {localTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet</p>
              ) : (
                localTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700"
                  >
                    {tag}
                    <button
                      onClick={() => removeLocalTag(tag)}
                      className="hover:text-violet-900"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Existing tags to add */}
            {allTags.filter((t) => !localTags.includes(t)).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Existing tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter((t) => !localTags.includes(t))
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setLocalTags(normalizeTags([...localTags, tag]))}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-violet-400 hover:text-violet-600 transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* New tag input */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Add new tag</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocalTag())}
                  placeholder="Tag name…"
                  className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                  aria-label="New tag name"
                />
                <Button type="button" variant="outline" size="sm" onClick={addLocalTag}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
