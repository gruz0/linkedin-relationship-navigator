import Papa from 'papaparse'
import { strFromU8, unzipSync } from 'fflate'

export const ROLE_CATEGORIES = [
  'Founder',
  'CEO',
  'C-suite',
  'Investor',
  'Director',
  'VP',
  'Recruiting',
  'Engineering',
  'Product',
  'Sales & BD',
  'Marketing',
] as const

export type RoleCategory = (typeof ROLE_CATEGORIES)[number]
export type ConversationStatus = 'two-way' | 'outbound' | 'inbound' | 'none'

export interface Connection {
  id: string
  firstName: string
  lastName: string
  fullName: string
  profileUrl: string
  email: string
  company: string
  position: string
  connectedOn: Date | null
  connectedOnRaw: string
  roles: RoleCategory[]
  isIdentifiable: boolean
  dubaiCompanySignal: boolean
}

export interface MessageRecord {
  conversationId: string
  from: string
  to: string
  date: Date | null
  dateRaw: string
  subject: string
  content: string
  folder: string
  attachmentUrl: string
  direction: 'sent' | 'received'
}

export interface ConversationStats {
  status: ConversationStatus
  messageCount: number
  sentCount: number
  receivedCount: number
  conversationCount: number
  firstMessageAt: Date | null
  lastMessageAt: Date | null
  lastDirection: 'sent' | 'received' | null
}

export interface ArchiveData {
  sourceFileName: string
  connections: Connection[]
  messagesByPerson: Map<string, MessageRecord[]>
  statsByPerson: Map<string, ConversationStats>
  messageCount: number
  conversationCount: number
  archiveFileCount: number
  selfName: string
  unavailableConnectionCount: number
}

type CsvRow = Record<string, string>

const EMPTY_STATS: ConversationStats = {
  status: 'none',
  messageCount: 0,
  sentCount: 0,
  receivedCount: 0,
  conversationCount: 0,
  firstMessageAt: null,
  lastMessageAt: null,
  lastDirection: null,
}

export function normalizeProfileUrl(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .split('?')[0]
    .replace(/\/$/, '')
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, '')
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseProfileUrls(value: string): Set<string> {
  return new Set(
    value
      .split(/[,;\s]+/)
      .map(normalizeProfileUrl)
      .filter(Boolean),
  )
}

function parseCsv(text: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  if (result.errors.some((error) => error.type === 'Delimiter')) {
    throw new Error('A CSV file in the archive could not be read.')
  }
  return result.data
}

function parseConnectionsCsv(text: string): CsvRow[] {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  const rows = parsed.data
  const headerIndex = rows.findIndex((row) => row.includes('First Name') && row.includes('Connected On'))
  if (headerIndex < 0) throw new Error('Connections.csv has an unfamiliar format.')

  const headers = rows[headerIndex].map((header) => header.trim())
  return rows.slice(headerIndex + 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])),
  )
}

function parseConnectionDate(value: string): Date | null {
  const match = value.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/)
  if (!match) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months.indexOf(match[2])
  if (month < 0) return null
  return new Date(Number(match[3]), month, Number(match[1]))
}

function parseMessageDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(value.replace(' UTC', 'Z'))
  return Number.isNaN(date.valueOf()) ? null : date
}

export function classifyRole(title: string): RoleCategory[] {
  const roles: RoleCategory[] = []
  const rules: Array<[RoleCategory, RegExp]> = [
    ['Founder', /\b(?:co[- ]?)?founder\b/i],
    ['CEO', /\b(?:ceo|chief executive officer)\b/i],
    [
      'C-suite',
      /\b(?:ceo|cto|cfo|coo|cmo|cio|cpo|cro|chief\s+[a-z& -]+\s+officer)\b/i,
    ],
    ['Investor', /\b(?:investor|venture partner|general partner|investment partner|angel)\b/i],
    ['Director', /\b(?:director|managing director)\b/i],
    ['VP', /\b(?:vp|vice president)\b/i],
    ['Recruiting', /\b(?:recruiter|recruitment|talent acquisition|headhunter|people partner)\b/i],
    ['Engineering', /\b(?:engineer|engineering|developer|software architect|technical lead|tech lead)\b/i],
    ['Product', /\b(?:product manager|product lead|head of product|product owner|product director)\b/i],
    ['Sales & BD', /\b(?:sales|business development|account executive|commercial)\b/i],
    ['Marketing', /\b(?:marketing|growth|brand|communications|content lead)\b/i],
  ]
  for (const [role, pattern] of rules) if (pattern.test(title)) roles.push(role)
  return roles
}

function fileText(files: Record<string, Uint8Array>, fileName: string): string {
  const entry = Object.entries(files).find(([name]) => name.toLocaleLowerCase() === fileName.toLocaleLowerCase())
  if (!entry) throw new Error(`${fileName} was not found in this archive.`)
  return strFromU8(entry[1])
}

export async function parseLinkedInArchive(buffer: ArrayBuffer, sourceFileName = 'LinkedIn export.zip'): Promise<ArchiveData> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('This file is not a readable ZIP archive.')
  }

  const connectionRows = parseConnectionsCsv(fileText(files, 'Connections.csv'))
  const messageRows = parseCsv(fileText(files, 'messages.csv'))
  const profileRows = parseCsv(fileText(files, 'Profile.csv'))
  const profile = profileRows[0] ?? {}
  const selfName = `${profile['First Name'] ?? ''} ${profile['Last Name'] ?? ''}`.trim()
  const normalizedSelfName = normalizeName(selfName)

  const connections = connectionRows.map<Connection>((row, index) => {
    const profileUrl = normalizeProfileUrl(row.URL ?? '')
    const firstName = row['First Name'] ?? ''
    const lastName = row['Last Name'] ?? ''
    const position = row.Position ?? ''
    const isIdentifiable = Boolean(profileUrl && (firstName || lastName))
    return {
      id: profileUrl || `unavailable-${index}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || 'Unavailable profile',
      profileUrl,
      email: row['Email Address'] ?? '',
      company: row.Company ?? '',
      position,
      connectedOn: parseConnectionDate(row['Connected On'] ?? ''),
      connectedOnRaw: row['Connected On'] ?? '',
      roles: classifyRole(position),
      isIdentifiable,
      dubaiCompanySignal: /\bdubai\b/i.test(row.Company ?? ''),
    }
  })

  const connectionIds = new Set(connections.filter((person) => person.profileUrl).map((person) => person.id))
  const selfUrls = new Set(
    messageRows
      .filter((row) => normalizeName(row.FROM ?? '') === normalizedSelfName)
      .map((row) => normalizeProfileUrl(row['SENDER PROFILE URL'] ?? ''))
      .filter(Boolean),
  )
  const messagesByPerson = new Map<string, MessageRecord[]>()
  const conversationIds = new Set<string>()

  for (const row of messageRows) {
    const senderUrl = normalizeProfileUrl(row['SENDER PROFILE URL'] ?? '')
    const recipientUrls = parseProfileUrls(row['RECIPIENT PROFILE URLS'] ?? '')
    const touchedConnections = new Set<string>()
    if (connectionIds.has(senderUrl)) touchedConnections.add(senderUrl)
    for (const url of recipientUrls) if (connectionIds.has(url)) touchedConnections.add(url)

    const direction = selfUrls.has(senderUrl) || normalizeName(row.FROM ?? '') === normalizedSelfName ? 'sent' : 'received'
    const message: MessageRecord = {
      conversationId: row['CONVERSATION ID'] ?? '',
      from: row.FROM ?? '',
      to: row.TO ?? '',
      date: parseMessageDate(row.DATE ?? ''),
      dateRaw: row.DATE ?? '',
      subject: row.SUBJECT ?? '',
      content: row.CONTENT ?? '',
      folder: row.FOLDER ?? '',
      attachmentUrl: row.ATTACHMENTS ?? '',
      direction,
    }
    if (message.conversationId) conversationIds.add(message.conversationId)
    for (const id of touchedConnections) {
      const personMessages = messagesByPerson.get(id) ?? []
      personMessages.push(message)
      messagesByPerson.set(id, personMessages)
    }
  }

  const statsByPerson = new Map<string, ConversationStats>()
  for (const connection of connections) {
    const messages = messagesByPerson.get(connection.id)
    if (!messages?.length) {
      statsByPerson.set(connection.id, { ...EMPTY_STATS })
      continue
    }
    messages.sort((a, b) => (b.date?.valueOf() ?? 0) - (a.date?.valueOf() ?? 0))
    const sentCount = messages.filter((message) => message.direction === 'sent').length
    const receivedCount = messages.length - sentCount
    const dated = messages.filter((message) => message.date)
    const status: ConversationStatus = sentCount && receivedCount ? 'two-way' : sentCount ? 'outbound' : 'inbound'
    statsByPerson.set(connection.id, {
      status,
      messageCount: messages.length,
      sentCount,
      receivedCount,
      conversationCount: new Set(messages.map((message) => message.conversationId).filter(Boolean)).size,
      firstMessageAt: dated.at(-1)?.date ?? null,
      lastMessageAt: dated[0]?.date ?? null,
      lastDirection: messages[0]?.direction ?? null,
    })
  }

  return {
    sourceFileName,
    connections,
    messagesByPerson,
    statsByPerson,
    messageCount: messageRows.length,
    conversationCount: conversationIds.size,
    archiveFileCount: Object.keys(files).length,
    selfName,
    unavailableConnectionCount: connections.filter((person) => !person.isIdentifiable).length,
  }
}

export function statsFor(data: ArchiveData, personId: string): ConversationStats {
  return data.statsByPerson.get(personId) ?? { ...EMPTY_STATS }
}
