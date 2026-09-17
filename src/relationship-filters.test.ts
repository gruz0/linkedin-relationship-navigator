import { describe, expect, it } from 'vitest'
import type { ConversationStats } from './data'
import {
  matchesLastDirectionFilter,
  matchesMessageDepthFilter,
  matchesRecencyFilter,
  matchesRelationshipFilters,
  matchesThreadCountFilter,
} from './relationship-filters'

const referenceDate = new Date('2026-09-01T12:00:00.000Z')

function stats(
  messageCount: number,
  lastMessageAt: Date | null,
  conversationCount = messageCount ? 1 : 0,
  lastDirection: ConversationStats['lastDirection'] = messageCount ? 'received' : null,
): ConversationStats {
  return {
    status: messageCount ? 'two-way' : 'none',
    messageCount,
    sentCount: Math.ceil(messageCount / 2),
    receivedCount: Math.floor(messageCount / 2),
    conversationCount,
    firstMessageAt: lastMessageAt,
    lastMessageAt,
    lastDirection,
  }
}

describe('relationship filters', () => {
  it('uses inclusive day boundaries and excludes missing dates from active recency ranges', () => {
    expect(matchesRecencyFilter(stats(4, new Date('2026-06-03T12:00:00.000Z')), '90-days', referenceDate)).toBe(true)
    expect(matchesRecencyFilter(stats(4, new Date('2026-06-03T12:00:01.000Z')), '90-days', referenceDate)).toBe(false)
    expect(matchesRecencyFilter(stats(0, null), '1-year', referenceDate)).toBe(false)
  })

  it('keeps message-depth ranges mutually exclusive at their boundaries', () => {
    expect(matchesMessageDepthFilter(stats(1, referenceDate), '1-2')).toBe(true)
    expect(matchesMessageDepthFilter(stats(2, referenceDate), '1-2')).toBe(true)
    expect(matchesMessageDepthFilter(stats(3, referenceDate), '3-9')).toBe(true)
    expect(matchesMessageDepthFilter(stats(9, referenceDate), '3-9')).toBe(true)
    expect(matchesMessageDepthFilter(stats(10, referenceDate), '10-plus')).toBe(true)
    expect(matchesMessageDepthFilter(stats(0, null), '1-2')).toBe(false)
  })

  it('keeps thread-count ranges mutually exclusive and excludes people without matched threads', () => {
    expect(matchesThreadCountFilter(stats(2, referenceDate, 1), '1')).toBe(true)
    expect(matchesThreadCountFilter(stats(6, referenceDate, 2), '2-3')).toBe(true)
    expect(matchesThreadCountFilter(stats(8, referenceDate, 3), '2-3')).toBe(true)
    expect(matchesThreadCountFilter(stats(12, referenceDate, 4), '4-plus')).toBe(true)
    expect(matchesThreadCountFilter(stats(0, null), '1')).toBe(false)
  })

  it('matches the observed direction of the latest archived message', () => {
    expect(matchesLastDirectionFilter(stats(4, referenceDate, 1, 'sent'), 'sent')).toBe(true)
    expect(matchesLastDirectionFilter(stats(4, referenceDate, 1, 'sent'), 'received')).toBe(false)
    expect(matchesLastDirectionFilter(stats(0, null), 'sent')).toBe(false)
  })

  it('requires both active relationship conditions to match', () => {
    const strongAndQuiet = stats(12, new Date('2025-07-01T12:00:00.000Z'))
    const recent = stats(12, new Date('2026-08-01T12:00:00.000Z'))
    const shallow = stats(4, new Date('2025-07-01T12:00:00.000Z'))

    expect(matchesRelationshipFilters(strongAndQuiet, '1-year', '10-plus', '1', 'received', referenceDate)).toBe(true)
    expect(matchesRelationshipFilters(recent, '1-year', '10-plus', '1', 'received', referenceDate)).toBe(false)
    expect(matchesRelationshipFilters(shallow, '1-year', '10-plus', '1', 'received', referenceDate)).toBe(false)
  })
})
