import React, { useState } from 'react'
import { Upload, FileText, Trash2, ExternalLink, RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { documentsService } from '@/services/documents'
import { useAppStore } from '@/store/appStore'
import { formatDate } from '@/utils/dates'
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, SUPPORTED_DOCUMENT_TYPES } from '@/utils/constants'
import type { Document } from '@/types'

export default function Documents() {
  const { state, loadState, removeDocument } = useAppStore()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const documents = state?.documents ?? []
  const driveSync = state?.settings.driveSync
  const driveFolder = state?.settings.driveFolder

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadError(null)

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      setUploadError(`Files must be under ${MAX_FILE_SIZE_MB} MB: ${oversized.map((f) => f.name).join(', ')}`)
      return
    }

    setUploading(true)
    try {
      const { documents: uploaded, errors } = await documentsService.upload(files)
      await loadState()
      if (errors.length > 0) {
        toast.warning(`${uploaded.length} uploaded, ${errors.length} failed`)
      } else {
        toast.success(`${uploaded.length} file${uploaded.length !== 1 ? 's' : ''} uploaded`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (doc: Document) => {
    try {
      await documentsService.delete(doc.id)
      removeDocument(doc.id)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const statusVariant = (status: string): 'success' | 'warning' | 'secondary' => {
    if (status === 'stored') return 'success'
    if (status === 'review') return 'warning'
    return 'secondary'
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground">Receipts, statements, and invoices</p>
      </div>

      {/* Upload + Drive cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Upload documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              PDF, images, CSV, spreadsheets — up to {MAX_FILE_SIZE_MB} MB each.
            </p>
            {uploadError && (
              <div className="mb-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {uploadError}
              </div>
            )}
            <label className="cursor-pointer">
              <Button variant="outline" loading={uploading}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Choose files
              </Button>
              <input
                type="file"
                multiple
                onChange={handleUpload}
                className="sr-only"
                aria-label="Upload document files"
              />
            </label>
          </CardContent>
        </Card>

        {/* Drive inbox card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Google Drive inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driveFolder ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{driveFolder.name}</p>
                  <Badge variant="info">Active</Badge>
                </div>
                <a
                  href={driveFolder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                >
                  Open folder
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                {driveSync?.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDate(driveSync.lastSyncedAt.split('T')[0])}
                    {driveSync.imported !== undefined && ` · ${driveSync.imported} imported`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Drive folder not configured. Add files to{' '}
                <strong>FinTrack Financial Inbox</strong> in Google Drive and they will sync at
                8:00 AM daily.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document vault */}
      <Card>
        <CardHeader>
          <CardTitle>Document vault ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FileText className="h-6 w-6" aria-hidden="true" />}
                title="No documents yet"
                description="Upload a file or add one to your Drive inbox."
                className="border-0"
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Filename</span>
                <span>Type</span>
                <span>Size</span>
                <span>Status</span>
                <span className="w-8" />
              </div>
              <ul className="divide-y divide-border" role="list">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 group">
                    <FileText className="h-8 w-8 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(doc.createdAt.split('T')[0])} · {doc.source === 'google-drive' ? 'Drive' : 'Upload'} · {formatBytes(doc.size)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(doc.status)} className="hidden sm:inline-flex capitalize">
                      {doc.status}
                    </Badge>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                      aria-label={`Delete ${doc.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
