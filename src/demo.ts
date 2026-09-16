import {
  ARCHIVE_FILES_USED,
  type ArchiveData,
  type Connection,
  type ConversationStats,
  type MessageRecord,
  classifyRole,
} from './data'
import { type PersonAnnotation, type WorkspaceFile, createWorkspace } from './workspace'

const DEMO_NOW = new Date('2026-09-01T12:00:00.000Z')
const SELF_NAME = 'Alex Morgan'

const firstNames = [
  'Maya', 'Leo', 'Nora', 'Omar', 'Sofia', 'Theo', 'Amara', 'Jonas',
  'Leila', 'Milo', 'Zara', 'Elias', 'Anika', 'Noah', 'Iris', 'Samir',
  'Clara', 'Ravi', 'Elena', 'Hugo', 'Nadia', 'Felix', 'Mina', 'Adam',
]

const lastNames = [
  'Bennett', 'Chen', 'Das', 'El-Amin', 'Foster', 'Garcia', 'Hassan', 'Ito',
  'Jensen', 'Khan', 'Laurent', 'Mensah', 'Novak', 'Ortiz', 'Park', 'Quinn',
  'Rossi', 'Singh', 'Tan', 'Usman', 'Vega', 'Walker', 'Yilmaz', 'Zoric',
]

const companies = [
  'Northstar Labs', 'Lantern Works', 'Atlas Grove', 'Cedar Stack',
  'Orbit House', 'Daybreak Systems', 'Harborline', 'Paper Kite Studio',
  'Embergrid', 'Mosaic Field', 'Brightpath Ventures', 'Juniper Cloud',
  'Dubai Signal Labs', 'Copper Finch', 'Kindred Robotics', 'Tidal Market',
]

const positions = [
  'Founder & CEO',
  'Co-Founder & CTO',
  'General Partner',
  'VP of Product',
  'Director of Engineering',
  'Head of Talent Acquisition',
  'Chief Marketing Officer',
  'Business Development Director',
  'Senior Product Manager',
  'Software Engineer',
  'Angel Investor',
  'Chief Operating Officer',
  'VP of Sales',
  'Product Design Director',
  'Growth Marketing Lead',
  'Engineering Manager',
]

const messageCopy = [
  [
    'It was great meeting at the product roundtable. Would you be open to comparing notes next week?',
    'Absolutely. Tuesday afternoon would work well for me.',
    'Perfect, I will send a short agenda before then.',
    'Sounds good. Looking forward to it.',
  ],
  [
    'I enjoyed your thoughts on making internal tools easier to adopt.',
    'Thank you. The workflow design is often more important than the technology.',
    'That matches what we are seeing too. Let us stay in touch.',
    'Definitely—please send over the example you mentioned.',
  ],
  [
    'A colleague suggested we connect because we are both working around operational data.',
    'Good introduction. I would be happy to hear more about your approach.',
    'I can share a short walkthrough this week.',
    'Thursday morning is open on my side.',
  ],
]

function dateBefore(days: number, hours = 0) {
  return new Date(DEMO_NOW.valueOf() - ((days * 24 + hours) * 60 * 60 * 1000))
}

function makeMessage(
  person: Connection,
  index: number,
  step: number,
  direction: MessageRecord['direction'],
  content: string,
): MessageRecord {
  const date = dateBefore(4 + index * 3, step * 5)
  return {
    conversationId: `demo-conversation-${String(index + 1).padStart(3, '0')}`,
    from: direction === 'sent' ? SELF_NAME : person.fullName,
    to: direction === 'sent' ? person.fullName : SELF_NAME,
    date,
    dateRaw: date.toISOString(),
    subject: step === 0 ? ['Following up', 'Product roundtable', 'Introduction'][index % 3] : '',
    content,
    folder: 'INBOX',
    attachmentUrl: '',
    direction,
  }
}

function messagesFor(person: Connection, index: number): MessageRecord[] {
  const status = index % 4
  if (status === 3) return []
  const copy = messageCopy[index % messageCopy.length]
  const directions: MessageRecord['direction'][] = status === 0
    ? ['sent', 'received', 'sent', 'received']
    : status === 1
      ? ['sent', 'sent']
      : ['received', 'received']
  return directions
    .map((direction, step) => makeMessage(person, index, step, direction, copy[step]))
    .sort((left, right) => (right.date?.valueOf() ?? 0) - (left.date?.valueOf() ?? 0))
}

function statsForMessages(messages: MessageRecord[]): ConversationStats {
  if (!messages.length) {
    return {
      status: 'none',
      messageCount: 0,
      sentCount: 0,
      receivedCount: 0,
      conversationCount: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      lastDirection: null,
    }
  }
  const sentCount = messages.filter((message) => message.direction === 'sent').length
  const receivedCount = messages.length - sentCount
  return {
    status: sentCount && receivedCount ? 'two-way' : sentCount ? 'outbound' : 'inbound',
    messageCount: messages.length,
    sentCount,
    receivedCount,
    conversationCount: new Set(messages.map((message) => message.conversationId)).size,
    firstMessageAt: messages.at(-1)?.date ?? null,
    lastMessageAt: messages[0]?.date ?? null,
    lastDirection: messages[0]?.direction ?? null,
  }
}

export function createDemoData(): ArchiveData {
  const connections: Connection[] = Array.from({ length: 48 }, (_, index) => {
    const firstName = firstNames[index % firstNames.length]
    const lastName = lastNames[(index * 5 + Math.floor(index / firstNames.length)) % lastNames.length]
    const position = positions[index % positions.length]
    const company = companies[(index * 7) % companies.length]
    const connectedOn = dateBefore(18 + index * 13)
    return {
      id: `linkedin.com/in/common-ground-demo-${String(index + 1).padStart(3, '0')}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      profileUrl: `linkedin.com/in/common-ground-demo-${String(index + 1).padStart(3, '0')}`,
      email: `person-${String(index + 1).padStart(3, '0')}@example.test`,
      company,
      position,
      connectedOn,
      connectedOnRaw: connectedOn.toISOString(),
      roles: classifyRole(position),
      isIdentifiable: true,
      dubaiCompanySignal: /\bdubai\b/i.test(company),
    }
  })

  connections.push(
    {
      id: 'demo-unavailable-1', firstName: '', lastName: '', fullName: 'Unavailable profile',
      profileUrl: '', email: '', company: '', position: '', connectedOn: dateBefore(900),
      connectedOnRaw: '', roles: [], isIdentifiable: false, dubaiCompanySignal: false,
    },
    {
      id: 'demo-unavailable-2', firstName: '', lastName: '', fullName: 'Unavailable profile',
      profileUrl: '', email: '', company: '', position: '', connectedOn: dateBefore(1100),
      connectedOnRaw: '', roles: [], isIdentifiable: false, dubaiCompanySignal: false,
    },
  )

  const messagesByPerson = new Map<string, MessageRecord[]>()
  const statsByPerson = new Map<string, ConversationStats>()
  let messageCount = 0
  const conversationIds = new Set<string>()

  for (const [index, person] of connections.entries()) {
    const messages = person.isIdentifiable ? messagesFor(person, index) : []
    if (messages.length) messagesByPerson.set(person.id, messages)
    statsByPerson.set(person.id, statsForMessages(messages))
    messageCount += messages.length
    for (const message of messages) conversationIds.add(message.conversationId)
  }

  return {
    sourceFileName: 'common-ground-fictional-demo.zip',
    connections,
    messagesByPerson,
    statsByPerson,
    messageCount,
    conversationCount: conversationIds.size,
    archiveFileCount: 3,
    archiveFilesUsed: [...ARCHIVE_FILES_USED],
    selfName: SELF_NAME,
    unavailableConnectionCount: connections.filter((person) => !person.isIdentifiable).length,
  }
}

const demoLocations = ['Dubai', 'London', 'Berlin', 'Singapore', 'Toronto', 'Lisbon']
const demoTags = [
  ['warm introduction', 'fintech'],
  ['follow up', 'product'],
  ['investor', 'portfolio'],
  ['met at conference'],
  ['potential partner', 'operations'],
  ['design systems'],
]

export function createDemoWorkspace(data: ArchiveData): WorkspaceFile {
  const workspace = createWorkspace(data, DEMO_NOW)
  const updatedAt = DEMO_NOW.toISOString()
  const people: Record<string, PersonAnnotation> = {}
  for (const [index, person] of data.connections.filter((connection) => connection.isIdentifiable).slice(0, 18).entries()) {
    people[person.id] = {
      location: { value: demoLocations[index % demoLocations.length], source: 'manual', updatedAt },
      tags: { value: demoTags[index % demoTags.length], source: 'manual', updatedAt },
      notes: {
        value: [
          'Reconnect about the workflow idea discussed during the last conversation.',
          'Strong operator perspective. Share the next product update when it is ready.',
          'Possible introduction to the team working on data portability.',
        ][index % 3],
        source: 'manual',
        updatedAt,
      },
    }
  }
  return { ...workspace, people }
}
