import React, { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { transactionsService } from '@/services/transactions'
import { useAppStore } from '@/store/appStore'
import { parseAmount } from '@/utils/currency'
import { today } from '@/utils/dates'
import type { ImportResult, CsvColumnMapping, CsvRow } from '@/types'
import { documentsService } from '@/services/documents'
import { MAX_FILE_SIZE_BYTES, SUPPORTED_DOCUMENT_TYPES } from '@/utils/constants'

type Step = 'choose' | 'mapping' | 'preview' | 'result'
type ImportType = 'csv' | 'document'

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const { loadState } = useAppStore()
  const [step, setStep] = useState<Step>('choose')
  const [importType, setImportType] = useState<ImportType>('csv')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Partial<CsvColumnMapping>>({})
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setStep('choose')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setFiles([])
    setResult(null)
    setError(null)
    onClose()
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    if (!selectedFiles.length) return
    setError(null)

    if (importType === 'csv') {
      const file = selectedFiles[0]
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields ?? []
          setCsvHeaders(headers)
          setCsvRows(result.data.slice(0, 5)) // preview first 5

          // Auto-detect common column names
          const autoMap: Partial<CsvColumnMapping> = {}
          for (const h of headers) {
            const lower = h.toLowerCase()
            if (!autoMap.date && /date|posted/.test(lower)) autoMap.date = h
            if (!autoMap.merchant && /description|merchant|payee|memo/.test(lower))
              autoMap.merchant = h
            if (!autoMap.amount && /^amount$/.test(lower)) autoMap.amount = h
            if (!autoMap.debit && /debit|withdrawal/.test(lower)) autoMap.debit = h
            if (!autoMap.credit && /credit|deposit/.test(lower)) autoMap.credit = h
            if (!autoMap.category && /category/.test(lower)) autoMap.category = h
            if (!autoMap.account && /account/.test(lower)) autoMap.account = h
          }
          setMapping(autoMap)
          setStep('mapping')
        },
        error: (err) => setError(`CSV parse error: ${err.message}`),
      })
    } else {
      // Document upload - validate size/type
      const invalid = selectedFiles.filter(
        (f) => f.size > MAX_FILE_SIZE_BYTES || !SUPPORTED_DOCUMENT_TYPES.includes(f.type)
      )
      if (invalid.length > 0) {
        setError(
          `${invalid.map((f) => f.name).join(', ')} — files must be under 20 MB and a supported type`
        )
        return
      }
      setFiles(selectedFiles)
      setStep('preview')
    }
  }, [importType])

  const handleImportCsv = async () => {
    if (!mapping.date || !mapping.merchant) {
      setError('Date and merchant columns are required')
      return
    }
    setLoading(true)
    setError(null)

    try {
      // Re-parse entire file
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement
      const file = fileInput?.files?.[0]
      if (!file) throw new Error('No file selected')

      await new Promise<void>((resolve, reject) => {
        Papa.parse<CsvRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (parsed) => {
            try {
              const rows = parsed.data as CsvRow[]
              const transactions = []

              for (const row of rows) {
                const dateStr = row[mapping.date!]?.trim()
                const merchantStr = row[mapping.merchant!]?.trim()
                if (!dateStr || !merchantStr) continue

                // Parse amount
                let amount = 0
                let type: 'expense' | 'income' = 'expense'

                if (mapping.amount) {
                  const parsed = parseAmount(row[mapping.amount] ?? '')
                  if (!parsed) continue
                  amount = parsed.value
                  type = parsed.isNegative ? 'expense' : 'income'
                } else if (mapping.debit || mapping.credit) {
                  const debitVal = parseAmount(row[mapping.debit ?? ''] ?? '')
                  const creditVal = parseAmount(row[mapping.credit ?? ''] ?? '')
                  if (debitVal?.value) {
                    amount = debitVal.value
                    type = 'expense'
                  } else if (creditVal?.value) {
                    amount = creditVal.value
                    type = 'income'
                  } else {
                    continue
                  }
                } else {
                  continue
                }

                if (amount <= 0) continue

                // Normalize date
                let date = dateStr
                const dateParsed = new Date(dateStr)
                if (!isNaN(dateParsed.getTime())) {
                  date = dateParsed.toISOString().split('T')[0]
                }

                transactions.push({
                  date,
                  merchant: merchantStr,
                  amount,
                  type,
                  category: (mapping.category && row[mapping.category]) || 'Needs review',
                  account: (mapping.account && row[mapping.account]) || 'Imported account',
                  tags: [],
                  receipt: false,
                  source: 'csv' as const,
                })
              }

              const importResult = await transactionsService.importBatch(transactions)
              setResult({
                inserted: importResult.inserted,
                duplicates: importResult.duplicates,
                skipped: importResult.skipped ?? 0,
                needsReview: importResult.needsReview ?? 0,
                errors: importResult.errors ?? [],
              })
              await loadState()
              setStep('result')
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          error: (err) => reject(new Error(err.message)),
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadDocuments = async () => {
    if (!files.length) return
    setLoading(true)
    setError(null)
    try {
      const { documents, errors } = await documentsService.upload(files)
      await loadState()
      setResult({
        inserted: documents.length,
        duplicates: 0,
        skipped: 0,
        needsReview: documents.filter((d) => d.status === 'review').length,
        errors,
      })
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import</DialogTitle>
        </DialogHeader>

        {/* Step: Choose */}
        {step === 'choose' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImportType('csv')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  importType === 'csv'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-border hover:border-violet-300'
                }`}
                aria-pressed={importType === 'csv'}
              >
                <FileText className="h-6 w-6 text-violet-600" aria-hidden="true" />
                <span className="text-sm font-medium">CSV statement</span>
                <span className="text-xs text-muted-foreground text-center">
                  Bank or card CSV exports
                </span>
              </button>
              <button
                type="button"
                onClick={() => setImportType('document')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                  importType === 'document'
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-border hover:border-violet-300'
                }`}
                aria-pressed={importType === 'document'}
              >
                <Upload className="h-6 w-6 text-violet-600" aria-hidden="true" />
                <span className="text-sm font-medium">Documents</span>
                <span className="text-xs text-muted-foreground text-center">
                  Receipts, PDFs, invoices
                </span>
              </button>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6">
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {importType === 'csv' ? 'Choose a CSV file' : 'Choose files to upload (max 20 MB each)'}
              </p>
              <label className="cursor-pointer">
                <span className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
                  Browse files
                </span>
                <input
                  id="csv-file-input"
                  type="file"
                  accept={importType === 'csv' ? '.csv,text/csv' : undefined}
                  multiple={importType === 'document'}
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label={importType === 'csv' ? 'Choose CSV file' : 'Choose document files'}
                />
              </label>
            </div>
          </div>
        )}

        {/* Step: Column mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to transaction fields.
            </p>
            {error && (
              <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {error}
              </div>
            )}
            <div className="space-y-3">
              {(
                [
                  { key: 'date', label: 'Date *', required: true },
                  { key: 'merchant', label: 'Merchant / description *', required: true },
                  { key: 'amount', label: 'Amount (single col)' },
                  { key: 'debit', label: 'Debit / withdrawal col' },
                  { key: 'credit', label: 'Credit / deposit col' },
                  { key: 'category', label: 'Category' },
                  { key: 'account', label: 'Account' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-44 flex-shrink-0 text-sm text-muted-foreground">{label}</span>
                  <Select
                    value={mapping[key as keyof CsvColumnMapping] ?? '_none'}
                    onValueChange={(v) =>
                      setMapping((m) => ({
                        ...m,
                        [key]: v === '_none' ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="— not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— not mapped —</SelectItem>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvRows.length > 0 && (
              <div className="overflow-x-auto">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Preview (first 5 rows)</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {csvHeaders.slice(0, 5).map((h) => (
                        <th key={h} className="border border-border px-2 py-1 text-left font-medium bg-muted">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {csvHeaders.slice(0, 5).map((h) => (
                          <td key={h} className="border border-border px-2 py-1 max-w-[80px] truncate">
                            {row[h] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('choose')}>
                Back
              </Button>
              <Button onClick={handleImportCsv} loading={loading}>
                Import CSV
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Document preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ready to upload {files.length} file(s).</p>
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                </li>
              ))}
            </ul>
            {error && (
              <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {error}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('choose')}>
                Back
              </Button>
              <Button onClick={handleUploadDocuments} loading={loading}>
                Upload {files.length} file{files.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Import complete</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Inserted', value: result.inserted, color: 'text-emerald-600' },
                { label: 'Duplicates', value: result.duplicates, color: 'text-amber-600' },
                { label: 'Skipped', value: result.skipped, color: 'text-muted-foreground' },
                { label: 'Needs review', value: result.needsReview, color: 'text-orange-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border p-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium mb-1">Errors:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
