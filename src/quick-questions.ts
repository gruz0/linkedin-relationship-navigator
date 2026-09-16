import {
  type ArchiveData,
  type Connection,
  type ConversationStatus,
  matchesRoleFilters,
  type RoleFilterCategory,
  statsFor,
} from './data'
import { type MessageDepthFilter, matchesRelationshipFilters, type RecencyFilter } from './relationship-filters'

export type QuickQuestion = {
  id: 'founders-spoken-with' | 'never-replied' | 'no-conversation-found' | 'strong-conversations-quiet'
  title: string
  filterSummary: string
  roles: readonly RoleFilterCategory[]
  conversation: ConversationStatus
  recency: RecencyFilter
  messageDepth: MessageDepthFilter
  sort: 'connected' | 'contacted'
}

export const QUICK_QUESTIONS: readonly QuickQuestion[] = [
  {
    id: 'founders-spoken-with',
    title: 'Founders I’ve spoken with',
    filterSummary: 'Founder · Two-way conversation',
    roles: ['Founder'],
    conversation: 'two-way',
    recency: 'all',
    messageDepth: 'all',
    sort: 'contacted',
  },
  {
    id: 'never-replied',
    title: 'People who never replied',
    filterSummary: 'Outbound only',
    roles: [],
    conversation: 'outbound',
    recency: 'all',
    messageDepth: 'all',
    sort: 'contacted',
  },
  {
    id: 'no-conversation-found',
    title: 'No conversation found',
    filterSummary: 'No matched messages',
    roles: [],
    conversation: 'none',
    recency: 'all',
    messageDepth: 'all',
    sort: 'connected',
  },
  {
    id: 'strong-conversations-quiet',
    title: 'Strong conversations that went quiet',
    filterSummary: 'Two-way · 10+ messages · 1+ year quiet',
    roles: [],
    conversation: 'two-way',
    recency: '1-year',
    messageDepth: '10-plus',
    sort: 'contacted',
  },
]

function matchesQuickQuestion(data: ArchiveData, person: Connection, question: QuickQuestion, referenceDate: Date) {
  const stats = statsFor(data, person.id)
  return (
    person.isIdentifiable &&
    matchesRoleFilters(person.roles, new Set(question.roles)) &&
    stats.status === question.conversation &&
    matchesRelationshipFilters(stats, question.recency, question.messageDepth, referenceDate)
  )
}

export function countQuickQuestionMatches(data: ArchiveData, question: QuickQuestion, referenceDate = new Date()) {
  return data.connections.filter((person) => matchesQuickQuestion(data, person, question, referenceDate)).length
}
