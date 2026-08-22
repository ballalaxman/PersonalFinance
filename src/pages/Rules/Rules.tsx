import React, { useState } from 'react'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Tag, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { RuleFormModal } from './RuleFormModal'
import { useAppStore } from '@/store/appStore'
import { api } from '@/services/api'
import { nanoid } from '@/utils/nanoid'
import type { Rule, Tag as TagType } from '@/types'

export default function Rules() {
  const { state, updateSettings, addRule, updateRule, removeRule, addTag, removeTag } = useAppStore()
  const [ruleFormOpen, setRuleFormOpen] = useState(false)
  const [editRule, setEditRule] = useState<Rule | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  const rules = state?.rules ?? []
  const tags = state?.tags ?? []

  // Count tag usage across transactions
  const tagUsage = (tagName: string) =>
    (state?.transactions ?? []).filter((t) => t.tags.includes(tagName)).length

  const handleSaveRule = async (rule: Rule) => {
    const isEdit = rules.some((r) => r.id === rule.id)
    try {
      if (isEdit) {
        const { rule: updated } = await api.patch<{ rule: Rule }>(`/api/rules/${rule.id}`, rule)
        updateRule(updated)
      } else {
        const { rule: created } = await api.post<{ rule: Rule }>('/api/rules', rule)
        addRule(created)
      }
      setRuleFormOpen(false)
      setEditRule(null)
    } catch {
      toast.error('Failed to save rule')
    }
  }

  const handleToggleRule = async (rule: Rule) => {
    try {
      const { rule: updated } = await api.patch<{ rule: Rule }>(`/api/rules/${rule.id}`, {
        ...rule,
        enabled: !rule.enabled,
      })
      updateRule(updated)
    } catch {
      toast.error('Failed to update rule')
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await api.delete(`/api/rules/${id}`)
      removeRule(id)
      toast.success('Rule deleted')
    } catch {
      toast.error('Failed to delete rule')
    }
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim().toLowerCase()
    if (!name) return
    if (tags.some((t) => t.name === name)) {
      toast.error('Tag already exists')
      return
    }
    setSavingTag(true)
    try {
      const { tag } = await api.post<{ tag: TagType }>('/api/tags', { name })
      addTag(tag)
      setNewTagName('')
      toast.success(`Tag "${tag.name}" created`)
    } catch {
      toast.error('Failed to create tag')
    } finally {
      setSavingTag(false)
    }
  }

  const handleDeleteTag = async (name: string) => {
    const usage = tagUsage(name)
    if (usage > 0) {
      const confirmed = window.confirm(
        `This tag is used by ${usage} transaction${usage !== 1 ? 's' : ''}. Remove it from all of them and delete the tag?`
      )
      if (!confirmed) return
    }
    try {
      await api.delete(`/api/tags/${encodeURIComponent(name)}`)
      removeTag(name)
      toast.success(`Tag "${name}" deleted`)
    } catch {
      toast.error('Failed to delete tag')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rules &amp; Tags</h1>
        <p className="text-sm text-muted-foreground">Auto-categorization rules and tag management</p>
      </div>

      {/* Rules section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Categorization rules
          </CardTitle>
          <Button size="sm" onClick={() => { setEditRule(null); setRuleFormOpen(true) }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create rule
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No rules yet"
                description="Rules apply to future transactions. They match merchant names and set categories or tags."
                className="border-0"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 px-5 py-3">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggleRule(rule)}
                    aria-label={`${rule.enabled ? 'Disable' : 'Enable'} rule`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="text-muted-foreground">When </span>
                      <span className="font-medium">{rule.whenText}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{rule.thenText}</span>
                    </p>
                    {!rule.enabled && (
                      <Badge variant="secondary" className="mt-1">Disabled</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditRule(rule); setRuleFormOpen(true) }} aria-label="Edit rule">
                      <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteRule(rule.id)} aria-label="Delete rule" className="hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tags section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Tags ({tags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Create tag */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
              placeholder="New tag name…"
              className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 min-h-[44px]"
              aria-label="New tag name"
            />
            <Button onClick={handleCreateTag} loading={savingTag} aria-label="Create tag">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet. Create one above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const usage = tagUsage(tag.name)
                return (
                  <div
                    key={tag.name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 pl-3 pr-2 py-1"
                  >
                    <span className="text-sm font-medium text-violet-700">{tag.name}</span>
                    {usage > 0 && (
                      <span className="text-xs text-violet-500 bg-violet-100 rounded-full px-1.5 py-0.5">
                        {usage}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteTag(tag.name)}
                      className="text-violet-400 hover:text-violet-700 leading-none"
                      aria-label={`Delete tag ${tag.name}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RuleFormModal
        open={ruleFormOpen}
        initial={editRule}
        onClose={() => { setRuleFormOpen(false); setEditRule(null) }}
        onSave={handleSaveRule}
      />
    </div>
  )
}
