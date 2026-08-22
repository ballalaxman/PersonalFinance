import { describe, expect, it } from 'vitest'
import { decodeTransactionTags, serializeTransaction } from './transactions'

describe('transaction serialization', () => {
  it('decodes and normalizes multiple tags', () => {
    expect(decodeTransactionTags('[" SIP ","tax","sip"]')).toEqual(['sip', 'tax'])
  })

  it('returns an empty array for malformed legacy data', () => {
    expect(decodeTransactionTags('not-json')).toEqual([])
  })

  it('normalizes API rows', () => {
    expect(serializeTransaction({ id: '1', receipt: 1, tags: '["one","two"]' })).toMatchObject({ receipt: true, tags: ['one', 'two'] })
  })
})
