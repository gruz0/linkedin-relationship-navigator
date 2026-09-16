import type { ConversationStats } from './data'

export type RecencyFilter = 'all' | '90-days' | '1-year' | '2-years'
export type MessageDepthFilter = 'all' | '1-2' | '3-9' | '10-plus'

export const RECENCY_FILTER_OPTIONS: ReadonlyArray<{ value: RecencyFilter; label: string }> = [
  { value: 'all', label: 'Any last contact' },
  { value: '90-days', label: '90+ days ago' },
  { value: '1-year', label: '1+ year ago' },
  { value: '2-years', label: '2+ years ago' },
]

export const MESSAGE_DEPTH_FILTER_OPTIONS: ReadonlyArray<{ value: MessageDepthFilter; label: string }> = [
  { value: 'all', label: 'Any message count' },
  { value: '1-2', label: '1–2 messages' },
  { value: '3-9', label: '3–9 messages' },
  { value: '10-plus', label: '10+ messages' },
]

export const RECENCY_FILTER_LABELS = Object.fromEntries(
  RECENCY_FILTER_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<RecencyFilter, string>

export const MESSAGE_DEPTH_FILTER_LABELS = Object.fromEntries(
  MESSAGE_DEPTH_FILTER_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<MessageDepthFilter, string>

const DAY_IN_MS = 24 * 60 * 60 * 1000

const recencyDays: Record<Exclude<RecencyFilter, 'all'>, number> = {
  '90-days': 90,
  '1-year': 365,
  '2-years': 730,
}

export function matchesRecencyFilter(stats: ConversationStats, filter: RecencyFilter, referenceDate: Date) {
  if (filter === 'all') return true
  if (!stats.lastMessageAt) return false
  return stats.lastMessageAt.valueOf() <= referenceDate.valueOf() - recencyDays[filter] * DAY_IN_MS
}

export function matchesMessageDepthFilter(stats: ConversationStats, filter: MessageDepthFilter) {
  if (filter === 'all') return true
  if (filter === '1-2') return stats.messageCount >= 1 && stats.messageCount <= 2
  if (filter === '3-9') return stats.messageCount >= 3 && stats.messageCount <= 9
  return stats.messageCount >= 10
}

export function matchesRelationshipFilters(
  stats: ConversationStats,
  recency: RecencyFilter,
  messageDepth: MessageDepthFilter,
  referenceDate: Date,
) {
  return matchesRecencyFilter(stats, recency, referenceDate) && matchesMessageDepthFilter(stats, messageDepth)
}
