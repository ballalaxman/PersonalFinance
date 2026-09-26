import { afterEach, describe, expect, it, vi } from 'vitest'
import { transactionsService } from './transactions'

const base = { date: '2026-09-01', merchant: 'Pharmacy', category: 'Health', amount: 450, type: 'expense' as const, account: 'Cash', tags: [], receipt: true }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('transactionsService.create with a receipt', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uploads the receipt to the document vault, then posts the transaction as JSON', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ documents: [{ id: 'd1', filename: 'r.pdf' }], errors: [] }, 201))
      .mockResolvedValueOnce(jsonResponse({ transaction: { id: 't1' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transactionsService.create({ ...base, receiptFile: new File(['x'], 'r.pdf', { type: 'application/pdf' }) })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/documents')
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/transactions')
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(sent).toMatchObject({ merchant: 'Pharmacy', receipt: true })
    expect(sent).not.toHaveProperty('receiptFile')
    expect(result.receiptDocument?.id).toBe('d1')
  })

  it('does not create the transaction when the receipt upload is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ documents: [], errors: ['r.exe: unsupported file type'] }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await expect(transactionsService.create({ ...base, receiptFile: new File(['x'], 'r.exe') })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
