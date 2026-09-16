import { describe, expect, it } from 'vitest'
import { createDemoData } from './demo'
import { countQuickQuestionMatches, QUICK_QUESTIONS } from './quick-questions'

describe('quick questions', () => {
  it('maps each question to transparent filters and a useful default sort', () => {
    expect(QUICK_QUESTIONS).toMatchObject([
      {
        id: 'founders-spoken-with',
        roles: ['Founder'],
        conversation: 'two-way',
        recency: 'all',
        messageDepth: 'all',
        sort: 'contacted',
      },
      {
        id: 'never-replied',
        roles: [],
        conversation: 'outbound',
        recency: 'all',
        messageDepth: 'all',
        sort: 'contacted',
      },
      {
        id: 'no-conversation-found',
        roles: [],
        conversation: 'none',
        recency: 'all',
        messageDepth: 'all',
        sort: 'connected',
      },
      {
        id: 'strong-conversations-quiet',
        roles: [],
        conversation: 'two-way',
        recency: '1-year',
        messageDepth: '10-plus',
        sort: 'contacted',
      },
    ])
  })

  it('calculates stable counts for the fictional demo', () => {
    const data = createDemoData()
    const counts = Object.fromEntries(
      QUICK_QUESTIONS.map((question) => [
        question.id,
        countQuickQuestionMatches(data, question, new Date('2026-09-01T12:00:00.000Z')),
      ]),
    )

    expect(counts).toEqual({
      'founders-spoken-with': 1,
      'never-replied': 12,
      'no-conversation-found': 12,
      'strong-conversations-quiet': 3,
    })
  })
})
