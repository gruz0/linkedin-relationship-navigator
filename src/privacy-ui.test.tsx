import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PersonDrawer, PersonRow } from './App'
import type { ArchiveData, Connection, MessageRecord } from './data'
import { createPrivacyAliases } from './privacy'
import type { PersonAnnotation } from './workspace'

const person: Connection = {
  id: 'linkedin.com/in/ada-lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  profileUrl: 'linkedin.com/in/ada-lovelace',
  email: 'ada@example.test',
  company: 'Analytical Engines Dubai',
  position: 'Founder & Chief Executive Officer',
  connectedOn: new Date('2026-01-02T00:00:00.000Z'),
  connectedOnRaw: '02 Jan 2026',
  roles: ['Founder', 'CEO', 'C-suite'],
  isIdentifiable: true,
  dubaiCompanySignal: true,
}

const message: MessageRecord = {
  conversationId: 'secret-conversation-id',
  from: 'Ada Lovelace',
  to: 'Test User',
  date: new Date('2026-02-03T10:00:00.000Z'),
  dateRaw: '2026-02-03 10:00:00 UTC',
  subject: 'Private fundraising subject',
  content: 'My private email is ada@example.test and my phone is 555-0100.',
  folder: 'INBOX',
  attachmentUrl: 'https://media.example.test/private-contract.pdf',
  direction: 'received',
}

const data: ArchiveData = {
  sourceFileName: 'private-export.zip',
  connections: [person],
  messagesByPerson: new Map([[person.id, [message]]]),
  statsByPerson: new Map([
    [
      person.id,
      {
        status: 'inbound',
        messageCount: 1,
        sentCount: 0,
        receivedCount: 1,
        conversationCount: 1,
        firstMessageAt: message.date,
        lastMessageAt: message.date,
        lastDirection: 'received',
      },
    ],
  ]),
  messageCount: 1,
  conversationCount: 1,
  archiveFileCount: 3,
  archiveFilesUsed: ['Connections.csv', 'messages.csv', 'Profile.csv'],
  selfName: 'Test User',
  unavailableConnectionCount: 0,
}

const annotation: PersonAnnotation = {
  location: { value: 'Dubai Marina', source: 'manual', updatedAt: '2026-09-01T00:00:00.000Z' },
  tags: { value: ['VIP investor'], source: 'manual', updatedAt: '2026-09-01T00:00:00.000Z' },
  notes: { value: 'Secret note about a future deal.', source: 'manual', updatedAt: '2026-09-01T00:00:00.000Z' },
}

const aliases = createPrivacyAliases([person])
const sensitiveValues = [
  'Ada',
  'Lovelace',
  'Analytical Engines',
  'Founder & Chief Executive Officer',
  'Dubai Marina',
  'VIP investor',
  'Secret note',
  'Private fundraising subject',
  'ada@example.test',
  '555-0100',
  'linkedin.com/in/ada-lovelace',
  'private-contract.pdf',
]

describe('Privacy mode UI', () => {
  it('keeps sensitive values out of a rendered connection row', () => {
    const html = renderToStaticMarkup(
      <PersonRow
        person={person}
        data={data}
        annotation={annotation}
        privacyMode
        privacyAliases={aliases}
        messageMatchCount={2}
        onClick={() => undefined}
      />,
    )

    expect(html).toContain('Person 001')
    expect(html).toContain('Company 001')
    expect(html).not.toContain('matching messages')
    for (const value of sensitiveValues) expect(html).not.toContain(value)
  })

  it('keeps names, annotations, messages, and links out of a rendered person drawer', () => {
    const html = renderToStaticMarkup(
      <PersonDrawer
        person={person}
        data={data}
        annotation={annotation}
        privacyMode
        privacyAliases={aliases}
        messageSearchQuery="private email"
        onAnnotationChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('Person 001')
    expect(html).toContain('Message content hidden in Privacy mode.')
    expect(html).not.toContain('href=')
    for (const value of sensitiveValues) expect(html).not.toContain(value)
  })

  it('shows message-search evidence and highlights only when Privacy mode is off', () => {
    const rowHtml = renderToStaticMarkup(
      <PersonRow
        person={person}
        data={data}
        annotation={annotation}
        privacyMode={false}
        privacyAliases={aliases}
        messageMatchCount={1}
        onClick={() => undefined}
      />,
    )
    const drawerHtml = renderToStaticMarkup(
      <PersonDrawer
        person={person}
        data={data}
        annotation={annotation}
        privacyMode={false}
        privacyAliases={aliases}
        messageSearchQuery="private email"
        onAnnotationChange={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(rowHtml).toContain('1 matching message')
    expect(drawerHtml).toContain('1 matching message')
    expect(drawerHtml).toContain('<mark>private email</mark>')
    expect(drawerHtml).toContain('Jump to first match')
  })
})
