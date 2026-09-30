import { describe, expect, it } from 'vitest'
import { isCalendarDate, isOutreachStatus, matchesOutreachActivity } from './outreach'

const referenceDate = new Date('2026-09-30T12:00:00.000Z')

describe('outreach workflow', () => {
  it('recognizes supported statuses and real calendar dates', () => {
    expect(isOutreachStatus('follow-up')).toBe(true)
    expect(isOutreachStatus('unknown')).toBe(false)
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-02-30')).toBe(false)
  })

  it('filters manual activity using inclusive day boundaries', () => {
    expect(matchesOutreachActivity(undefined, 'never', referenceDate)).toBe(true)
    expect(matchesOutreachActivity('2026-09-23', '7-days', referenceDate)).toBe(true)
    expect(matchesOutreachActivity('2026-09-22', '7-days', referenceDate)).toBe(false)
    expect(matchesOutreachActivity('2026-09-01', '30-days', referenceDate)).toBe(true)
    expect(matchesOutreachActivity('2026-08-30', 'older', referenceDate)).toBe(true)
  })
})
