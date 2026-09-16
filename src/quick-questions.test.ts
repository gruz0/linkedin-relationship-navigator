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
        sort: 'contacted',
      },
      {
        id: 'never-replied',
        roles: [],
        conversation: 'outbound',
        sort: 'contacted',
      },
      {
        id: 'no-conversation-found',
        roles: [],
        conversation: 'none',
        sort: 'connected',
      },
    ])
  })

  it('calculates stable counts for the fictional demo', () => {
    const data = createDemoData()
    const counts = Object.fromEntries(
      QUICK_QUESTIONS.map((question) => [question.id, countQuickQuestionMatches(data, question)]),
    )

    expect(counts).toEqual({
      'founders-spoken-with': 1,
      'never-replied': 12,
      'no-conversation-found': 12,
    })
  })
})
