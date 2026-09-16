import type { ArchiveData, Connection, ConversationStatus } from './data'
import { statsFor } from './data'
import { type PrivacyAliases, personPresentation } from './privacy'
import type { WorkspaceFile } from './workspace'

type ShortlistColumnKey =
  | 'name'
  | 'profileUrl'
  | 'company'
  | 'position'
  | 'roles'
  | 'relationship'
  | 'lastContact'
  | 'messages'
  | 'threads'
  | 'connectedOn'
  | 'location'
  | 'tags'
  | 'evidence'

export type ShortlistRow = Record<ShortlistColumnKey, string>

export type ShortlistColumn = {
  key: ShortlistColumnKey
  label: string
}

const relationshipLabels: Record<ConversationStatus, string> = {
  'two-way': 'Two-way',
  outbound: 'Outbound only',
  inbound: 'Inbound only',
  none: 'No messages found',
}

const privacyColumns: readonly ShortlistColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'roles', label: 'Roles' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'lastContact', label: 'Last contact' },
  { key: 'messages', label: 'Messages' },
  { key: 'threads', label: 'Threads' },
  { key: 'connectedOn', label: 'Connected on' },
  { key: 'evidence', label: 'Evidence' },
]

const realDataColumns: readonly ShortlistColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'profileUrl', label: 'Profile URL' },
  { key: 'company', label: 'Company' },
  { key: 'position', label: 'Position' },
  { key: 'roles', label: 'Roles' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'lastContact', label: 'Last contact' },
  { key: 'messages', label: 'Messages' },
  { key: 'threads', label: 'Threads' },
  { key: 'connectedOn', label: 'Connected on' },
  { key: 'location', label: 'Location' },
  { key: 'tags', label: 'Tags' },
  { key: 'evidence', label: 'Evidence' },
]

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ''
}

function safeProfileUrl(profileUrl: string) {
  return /^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(profileUrl) ? `https://www.${profileUrl}` : ''
}

export function shortlistColumns(privacyMode: boolean) {
  return privacyMode ? privacyColumns : realDataColumns
}

export function buildShortlistRows({
  people,
  data,
  workspace,
  privacyAliases,
  privacyMode,
}: {
  people: Connection[]
  data: ArchiveData
  workspace: WorkspaceFile
  privacyAliases: PrivacyAliases
  privacyMode: boolean
}): ShortlistRow[] {
  return people.map((person) => {
    const stats = statsFor(data, person.id)
    const presentation = personPresentation(person, privacyAliases, privacyMode)
    const annotation = workspace.people[person.id]
    const relationship = relationshipLabels[stats.status]
    const roles = person.roles.length ? person.roles.join(', ') : 'Other'
    const lastContact = dateValue(stats.lastMessageAt)
    const evidence = [
      relationship,
      `${stats.messageCount.toLocaleString('en')} messages`,
      lastContact ? `last contact ${lastContact}` : 'no matched contact',
      roles,
    ].join(' · ')

    return {
      name: presentation.name,
      profileUrl: privacyMode ? '' : safeProfileUrl(person.profileUrl),
      company: presentation.company,
      position: presentation.position,
      roles,
      relationship,
      lastContact,
      messages: String(stats.messageCount),
      threads: String(stats.conversationCount),
      connectedOn: dateValue(person.connectedOn),
      location: privacyMode ? '' : (annotation?.location?.value ?? ''),
      tags: privacyMode ? '' : (annotation?.tags?.value.join(', ') ?? ''),
      evidence,
    }
  })
}

function neutralizeSpreadsheetFormula(value: string) {
  return /^\s*[=+\-@]/.test(value) || /^[\t\r]/.test(value) ? `'${value}` : value
}

function csvCell(value: string) {
  return `"${neutralizeSpreadsheetFormula(value).replaceAll('"', '""')}"`
}

export function shortlistToCsv(rows: ShortlistRow[], columns: readonly ShortlistColumn[]) {
  const lines = [
    columns.map((column) => csvCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(',')),
  ]
  return `${lines.join('\r\n')}\r\n`
}

function markdownCell(value: string) {
  return value.replaceAll('|', '\\|').replace(/\r?\n/g, ' ')
}

export function shortlistToMarkdown(rows: ShortlistRow[], columns: readonly ShortlistColumn[]) {
  const header = `| ${columns.map((column) => markdownCell(column.label)).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${columns.map((column) => markdownCell(row[column.key])).join(' | ')} |`)
  return `# Common Ground shortlist\n\n${[header, divider, ...body].join('\n')}\n`
}

export function shortlistToCopyText(rows: ShortlistRow[], privacyMode: boolean) {
  return rows
    .map((row) => (privacyMode || !row.profileUrl ? `- ${row.name}` : `- ${row.name} — ${row.profileUrl}`))
    .join('\n')
}
