import { describe, expect, it } from 'vitest'
import type { MessageRecord } from './data'
import { countMessageMatches, messageMatchesSearch, normalizeSearchQuery, textMatchesSearch } from './message-search'

function message(subject: string, content: string): MessageRecord {
  return {
    conversationId: 'conversation-1',
    from: 'Person',
    to: 'Test User',
    date: null,
    dateRaw: '',
    subject,
    content,
    folder: 'INBOX',
    attachmentUrl: '',
    direction: 'received',
  }
}

describe('message search', () => {
  it('normalizes surrounding whitespace and case for literal term and phrase matching', () => {
    const query = normalizeSearchQuery('  Product ROUNDTable  ')

    expect(query).toBe('product roundtable')
    expect(textMatchesSearch('Notes from the Product Roundtable yesterday', query)).toBe(true)
    expect(textMatchesSearch('Product planning before a separate roundtable', query)).toBe(false)
  })

  it('matches either a message subject or body and counts each matching message once', () => {
    const messages = [
      message('Fundraising notes', 'The fundraising plan is attached.'),
      message('Following up', 'Let us revisit the fundraising plan.'),
      message('Unrelated', 'No matching topic here.'),
    ]

    expect(messageMatchesSearch(messages[0], 'fundraising')).toBe(true)
    expect(messageMatchesSearch(messages[2], 'fundraising')).toBe(false)
    expect(countMessageMatches(messages, 'fundraising')).toBe(2)
    expect(countMessageMatches(messages, '')).toBe(0)
  })

  it('treats punctuation and regular-expression characters as ordinary search text', () => {
    expect(textMatchesSearch('Can you review v2.0 (draft)?', 'v2.0 (draft)?')).toBe(true)
  })
})
