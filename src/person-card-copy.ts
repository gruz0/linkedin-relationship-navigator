import type { Connection, ConversationStats, MessageRecord } from './data'
import type { PersonPresentation } from './privacy'
import type { PersonAnnotation } from './workspace'

const relationshipLabels: Record<ConversationStats['status'], string> = {
  'two-way': 'Two-way',
  outbound: 'Outbound only',
  inbound: 'Inbound only',
  none: 'No messages found',
}

function dateValue(date: Date | null, fallback = 'Not available') {
  return date ? date.toISOString().slice(0, 10) : fallback
}

function profileUrl(value: string) {
  return /^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(value) ? `https://www.${value}` : 'Not available'
}

function field(label: string, value: string | number) {
  return `- ${label}: ${value === '' ? 'Not available' : value}`
}

function messageBlock(message: MessageRecord) {
  const direction = message.direction === 'sent' ? 'Sent' : 'Received'
  const lines = [`**${dateValue(message.date, message.dateRaw || 'Date unavailable')} · ${direction}**`]
  if (message.subject) lines.push(`- Subject: ${message.subject}`)
  lines.push('', message.content || '_Attachment or empty message_')
  if (message.attachmentUrl) lines.push('', `Attachment: ${message.attachmentUrl}`)
  return lines.join('\n')
}

export function personCardToCopyText({
  person,
  presentation,
  stats,
  messages,
  annotation,
  privacyMode,
  includeMessages = false,
}: {
  person: Connection
  presentation: PersonPresentation
  stats: ConversationStats
  messages: MessageRecord[]
  annotation?: PersonAnnotation
  privacyMode: boolean
  includeMessages?: boolean
}) {
  const sections = [
    '# LinkedIn relationship context',
    '',
    '## Person',
    field('Name', presentation.name),
    field('Position', presentation.position),
    field('Company', presentation.company),
    field('Role categories', person.roles.join(', ') || 'Other'),
    field('Connected on', dateValue(person.connectedOn, person.connectedOnRaw || 'Not available')),
  ]

  if (!privacyMode) {
    sections.push(field('LinkedIn profile', profileUrl(person.profileUrl)))
    sections.push(field('Location', annotation?.location?.value ?? 'Not available'))
    sections.push(field('Tags', annotation?.tags?.value.join(', ') ?? 'None'))
  }

  sections.push(
    '',
    '## Relationship',
    field('Status', relationshipLabels[stats.status]),
    field('Messages', stats.messageCount),
    field('Sent', stats.sentCount),
    field('Received', stats.receivedCount),
    field('Threads', stats.conversationCount),
    field('First contact', dateValue(stats.firstMessageAt)),
    field('Last contact', dateValue(stats.lastMessageAt)),
    field(
      'Last direction',
      stats.lastDirection === 'sent' ? 'Sent by me' : stats.lastDirection === 'received' ? 'Received' : 'Not available',
    ),
  )

  if (privacyMode) {
    sections.push(
      '',
      '## Privacy',
      'Privacy mode was on when this card was copied. Identifying details, annotations, and message contents are omitted.',
    )
    return `${sections.join('\n')}\n`
  }

  sections.push('', '## My notes', annotation?.notes?.value || '_No notes_')
  if (includeMessages) {
    const chronologicalMessages = messages
      .map((message, sourceIndex) => ({ message, sourceIndex }))
      .sort((left, right) => {
        const leftTime = left.message.date?.valueOf()
        const rightTime = right.message.date?.valueOf()
        if (leftTime === undefined && rightTime === undefined) return left.sourceIndex - right.sourceIndex
        if (leftTime === undefined) return 1
        if (rightTime === undefined) return -1
        return leftTime - rightTime || left.sourceIndex - right.sourceIndex
      })
      .map(({ message }) => message)

    sections.push('', `## Conversation history (${messages.length} ${messages.length === 1 ? 'message' : 'messages'})`)
    sections.push(
      chronologicalMessages.length
        ? chronologicalMessages.map((message) => messageBlock(message)).join('\n\n')
        : '_No matching conversation was found in the LinkedIn archive._',
    )
  }

  return `${sections.join('\n')}\n`
}
