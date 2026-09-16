import {
  type ArchiveData,
  type Connection,
  type ConversationStatus,
  matchesRoleFilters,
  type RoleFilterCategory,
  statsFor,
} from './data'

export type QuickQuestion = {
  id: 'founders-spoken-with' | 'never-replied' | 'no-conversation-found'
  title: string
  filterSummary: string
  roles: readonly RoleFilterCategory[]
  conversation: ConversationStatus
  sort: 'connected' | 'contacted'
}

export const QUICK_QUESTIONS: readonly QuickQuestion[] = [
  {
    id: 'founders-spoken-with',
    title: 'Founders I’ve spoken with',
    filterSummary: 'Founder · Two-way conversation',
    roles: ['Founder'],
    conversation: 'two-way',
    sort: 'contacted',
  },
  {
    id: 'never-replied',
    title: 'People who never replied',
    filterSummary: 'Outbound only',
    roles: [],
    conversation: 'outbound',
    sort: 'contacted',
  },
  {
    id: 'no-conversation-found',
    title: 'No conversation found',
    filterSummary: 'No matched messages',
    roles: [],
    conversation: 'none',
    sort: 'connected',
  },
]

function matchesQuickQuestion(data: ArchiveData, person: Connection, question: QuickQuestion) {
  return (
    person.isIdentifiable &&
    matchesRoleFilters(person.roles, new Set(question.roles)) &&
    statsFor(data, person.id).status === question.conversation
  )
}

export function countQuickQuestionMatches(data: ArchiveData, question: QuickQuestion) {
  return data.connections.filter((person) => matchesQuickQuestion(data, person, question)).length
}
