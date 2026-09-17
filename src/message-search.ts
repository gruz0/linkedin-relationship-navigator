import type { MessageRecord } from './data'

export function normalizeSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase()
}

export function textMatchesSearch(value: string, normalizedQuery: string) {
  return Boolean(normalizedQuery) && value.toLocaleLowerCase().includes(normalizedQuery)
}

export function messageMatchesSearch(message: MessageRecord, normalizedQuery: string) {
  return textMatchesSearch(message.subject, normalizedQuery) || textMatchesSearch(message.content, normalizedQuery)
}

export function countMessageMatches(messages: readonly MessageRecord[], normalizedQuery: string) {
  if (!normalizedQuery) return 0
  return messages.reduce((count, message) => count + Number(messageMatchesSearch(message, normalizedQuery)), 0)
}
