import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RESULT_BATCH_SIZE,
  nextVisibleResultCount,
  parseResultBatchSize,
  RESULT_BATCH_SIZES,
} from './result-batching'

describe('result batching', () => {
  it('offers deliberate batch sizes and defaults to 50', () => {
    expect(RESULT_BATCH_SIZES).toEqual([25, 50, 100, 250, 500])
    expect(DEFAULT_RESULT_BATCH_SIZE).toBe(50)
  })

  it('parses supported sizes and falls back safely', () => {
    expect(parseResultBatchSize('100')).toBe(100)
    expect(parseResultBatchSize('60')).toBe(DEFAULT_RESULT_BATCH_SIZE)
    expect(parseResultBatchSize('not-a-number')).toBe(DEFAULT_RESULT_BATCH_SIZE)
  })

  it('adds one batch without exceeding the result total', () => {
    expect(nextVisibleResultCount(50, 50, 1660)).toBe(100)
    expect(nextVisibleResultCount(1650, 50, 1660)).toBe(1660)
  })
})
