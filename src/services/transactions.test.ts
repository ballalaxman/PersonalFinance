import { afterEach, describe, expect, it, vi } from 'vitest'
import { transactionsService } from './transactions'
import { isDuplicateError } from './api'

const base = { date: '2026-09-01', merchant: 'Pharmacy', category: 'Health', amount: 450, type: 'expense' as const, account: 'Cash', tags: [], receipt: true }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('transactionsService.create with a receipt', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('saves the transaction first, then attaches the receipt to it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ transaction: { id: 't1', receipt: false } }, 201))
      .mockResolvedValueOnce(jsonResponse({ documents: [{ id: 'd1', filename: 'r.pdf' }], errors: [] }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transactionsService.create({ ...base, receiptFile: new File(['x'], 'r.pdf', { type: 'application/pdf' }) })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/transactions')
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toMatchObject({ merchant: 'Pharmacy', receipt: false })
    expect(sent).not.toHaveProperty('receiptFile')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/documents')
    const form = fetchMock.mock.calls[1][1].body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('transactionId')).toBe('t1')
    expect(result.transaction).toMatchObject({ id: 't1', receipt: true, receiptDocumentId: 'd1' })
    expect(result.receiptDocument?.id).toBe('d1')
  })

  it('keeps the transaction and says why when the receipt upload is rejected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ transaction: { id: 't1', receipt: false } }, 201))
      .mockResolvedValueOnce(jsonResponse({ documents: [], errors: ['r.exe: unsupported file type'] }, 400))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transactionsService.create({ ...base, receiptFile: new File(['x'], 'r.exe') })

    expect(result.transaction).toMatchObject({ id: 't1', receipt: false })
    expect(result.receiptDocument).toBeUndefined()
    expect(result.receiptError).toBe('r.exe: unsupported file type')
  })

  it('uploads nothing when the transaction is refused as a look-alike', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'Duplicate transaction', duplicate: true }, 409))
    vi.stubGlobal('fetch', fetchMock)

    const error = await transactionsService.create({ ...base, receiptFile: new File(['x'], 'r.pdf', { type: 'application/pdf' }) }).catch((e) => e)

    expect(isDuplicateError(error)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
