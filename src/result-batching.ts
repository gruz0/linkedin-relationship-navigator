export const RESULT_BATCH_SIZES = [25, 50, 100, 250, 500] as const

export type ResultBatchSize = (typeof RESULT_BATCH_SIZES)[number]

export const DEFAULT_RESULT_BATCH_SIZE: ResultBatchSize = 50

export function parseResultBatchSize(value: string): ResultBatchSize {
  const size = Number(value)
  return RESULT_BATCH_SIZES.find((option) => option === size) ?? DEFAULT_RESULT_BATCH_SIZE
}

export function nextVisibleResultCount(current: number, batchSize: ResultBatchSize, total: number) {
  return Math.min(current + batchSize, total)
}
