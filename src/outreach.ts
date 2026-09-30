export type OutreachStatus =
  | 'not-started'
  | 'contacted'
  | 'in-conversation'
  | 'follow-up'
  | 'meeting-booked'
  | 'done'
  | 'not-a-fit'

export const OUTREACH_STATUS_OPTIONS: readonly { value: OutreachStatus; label: string }[] = [
  { value: 'not-started', label: 'Not started' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in-conversation', label: 'In conversation' },
  { value: 'follow-up', label: 'Follow up' },
  { value: 'meeting-booked', label: 'Meeting booked' },
  { value: 'done', label: 'Done' },
  { value: 'not-a-fit', label: 'Not a fit' },
]

export const OUTREACH_STATUS_LABELS = Object.fromEntries(
  OUTREACH_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OutreachStatus, string>

export type OutreachStatusFilter = OutreachStatus | 'all'
export type OutreachActivityFilter = 'all' | 'never' | '7-days' | '30-days' | 'older'

export const OUTREACH_ACTIVITY_OPTIONS: readonly { value: OutreachActivityFilter; label: string }[] = [
  { value: 'all', label: 'Any activity date' },
  { value: 'never', label: 'Never contacted' },
  { value: '7-days', label: 'Within 7 days' },
  { value: '30-days', label: 'Within 30 days' },
  { value: 'older', label: 'More than 30 days ago' },
]

export const OUTREACH_ACTIVITY_LABELS = Object.fromEntries(
  OUTREACH_ACTIVITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OutreachActivityFilter, string>

const DAY_MS = 24 * 60 * 60 * 1000

export function isOutreachStatus(value: unknown): value is OutreachStatus {
  return OUTREACH_STATUS_OPTIONS.some((option) => option.value === value)
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export function matchesOutreachActivity(
  lastContactedAt: string | undefined,
  filter: OutreachActivityFilter,
  referenceDate = new Date(),
) {
  if (filter === 'all') return true
  if (!lastContactedAt) return filter === 'never'
  if (filter === 'never') return false

  if (!isCalendarDate(lastContactedAt)) return false
  const activityDay = Date.parse(`${lastContactedAt}T00:00:00.000Z`)
  const referenceDay = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const ageInDays = Math.max(0, Math.floor((referenceDay - activityDay) / DAY_MS))
  if (filter === '7-days') return ageInDays <= 7
  if (filter === '30-days') return ageInDays <= 30
  return ageInDays > 30
}
